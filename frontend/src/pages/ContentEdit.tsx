/**
 * 内容编辑页面 - 完整标书预览和生成
 */
import React, { useState, useEffect, useCallback } from 'react';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Blockquote from '@tiptap/extension-blockquote';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table, TableHeader } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';

import { OutlineData, OutlineItem } from '../types';
import { DocumentTextIcon, PlayIcon, DocumentArrowDownIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import { contentApi, ChapterContentRequest, documentApi } from '../services/api';
import { saveAs } from 'file-saver';
import { Paragraph, TextRun } from 'docx';

interface ContentEditProps {
  outlineData: OutlineData | null;
  selectedChapter: string | null;
  onChapterSelect: (chapterId: string) => void;
  updateOutline: (outlineData: OutlineData) => void;
}

interface GenerationProgress {
  total: number;
  completed: number;
  current: string;
  failed: string[];
  generating: Set<string>; // 正在生成的项目ID集合
}

const ContentEdit: React.FC<ContentEditProps> = ({
  outlineData,
  selectedChapter,
  onChapterSelect,
  updateOutline,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({
    total: 0,
    completed: 0,
    current: '',
    failed: [],
    generating: new Set<string>()
  });
  const [leafItems, setLeafItems] = useState<OutlineItem[]>([]);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null); // 当前正在编辑的章节ID
  const [editContent, setEditContent] = useState<string>(''); // 编辑模式下的内容

  // 收集所有叶子节点
  const collectLeafItems = useCallback((items: OutlineItem[]): OutlineItem[] => {
    let leaves: OutlineItem[] = [];
    items.forEach(item => {
      if (!item.children || item.children.length === 0) {
        leaves.push(item);
      } else {
        leaves = leaves.concat(collectLeafItems(item.children));
      }
    });
    return leaves;
  }, []);

  // 从outlineData生成全文内容
  const generateFullContent = useCallback((items: OutlineItem[]): string => {
    let content = '';
    items.forEach(item => {
      // 添加章节标题
      const level = item.id.split('.').length;
      content += `${'#'.repeat(level)} ${item.id} ${item.title}\n\n`;
      
      // 添加章节内容
      if (item.content) {
        content += `${item.content}\n\n`;
      }
      
      // 递归处理子章节
      if (item.children && item.children.length > 0) {
        content += generateFullContent(item.children);
      }
    });
    return content;
  }, []);

  // 获取章节的上级章节信息
  const getParentChapters = useCallback((targetId: string, items: OutlineItem[], parents: OutlineItem[] = []): OutlineItem[] => {
    for (const item of items) {
      if (item.id === targetId) {
        return parents;
      }
      if (item.children && item.children.length > 0) {
        const found = getParentChapters(targetId, item.children, [...parents, item]);
        if (found.length > 0 || item.children.some(child => child.id === targetId)) {
          return found.length > 0 ? found : [...parents, item];
        }
      }
    }
    return [];
  }, []);

  // 获取章节的同级章节信息
  const getSiblingChapters = useCallback((targetId: string, items: OutlineItem[]): OutlineItem[] => {
    // 直接在当前级别查找
    if (items.some(item => item.id === targetId)) {
      return items;
    }
    
    // 递归在子级别查找
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        const siblings = getSiblingChapters(targetId, item.children);
        if (siblings.length > 0) {
          return siblings;
        }
      }
    }
    
    return [];
  }, []);

  // 生成唯一ID
  const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // 新增子目录
  const handleAddSubChapter = (parentId: string) => {
    if (!outlineData || !updateOutline) return;

    const addSubChapter = (items: OutlineItem[]): OutlineItem[] => {
      return items.map(item => {
        if (item.id === parentId) {
          // 找到父节点，添加新的子节点
          const newItem: OutlineItem = {
            id: generateId(),
            title: `新章节 ${item.children ? item.children.length + 1 : 1}`,
            description: '',
            content: '',
            children: []
          };
          
          return {
            ...item,
            children: [...(item.children || []), newItem]
          };
        }
        
        // 递归处理子节点
        if (item.children && item.children.length > 0) {
          return {
            ...item,
            children: addSubChapter(item.children)
          };
        }
        
        return item;
      });
    };

    const updatedOutline = addSubChapter(outlineData.outline);
    updateOutline({ ...outlineData, outline: updatedOutline });
  };

  // 删除目录
  const handleDeleteChapter = (chapterId: string) => {
    if (!outlineData || !updateOutline) return;

    // 确认删除
    if (!window.confirm('确定要删除这个目录及其所有子目录和内容吗？')) {
      return;
    }

    // 收集所有需要删除的节点ID（包括当前节点和所有子节点）
    const collectNodeIdsToDelete = (items: OutlineItem[]): string[] => {
      let idsToDelete: string[] = [];
      
      const collectIds = (node: OutlineItem): string[] => {
        let result: string[] = [node.id];
        
        // 递归收集所有子节点ID
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => {
            result = result.concat(collectIds(child));
          });
        }
        
        return result;
      };
      
      // 遍历所有节点，找到目标节点并收集其所有子节点ID
      items.forEach(item => {
        if (item.id === chapterId) {
          // 找到目标节点，收集其所有子节点ID
          idsToDelete = collectIds(item);
        } else if (item.children && item.children.length > 0) {
          // 递归检查子节点
          idsToDelete = idsToDelete.concat(collectNodeIdsToDelete(item.children));
        }
      });
      
      return idsToDelete;
    };

    const idsToDelete = collectNodeIdsToDelete(outlineData.outline);

    // 删除目录节点
    const deleteChapter = (items: OutlineItem[]): OutlineItem[] => {
      return items.filter(item => {
        if (item.id === chapterId) {
          return false; // 删除当前项
        }
        
        // 递归处理子节点
        if (item.children && item.children.length > 0) {
          item.children = deleteChapter(item.children);
        }
        
        return true;
      });
    };

    const updatedOutline = deleteChapter(outlineData.outline);
    
    // 删除对应的内容是不需要单独处理的，因为内容直接存储在OutlineItem的content属性中
    // 当节点从outline中删除后，其包含的content也会随之删除
    updateOutline({ ...outlineData, outline: updatedOutline });

    // 如果删除的是当前选中的章节或其任何子章节，清除选中状态
    if (selectedChapter && idsToDelete.includes(selectedChapter)) {
      onChapterSelect('');
    }

    // 如果正在编辑的章节被删除，退出编辑模式
    if (editingItemId && idsToDelete.includes(editingItemId)) {
      setEditingItemId(null);
    }
  };

  // 同步更新富文本编辑器内容


  useEffect(() => {
    if (outlineData) {
      const leaves = collectLeafItems(outlineData.outline);
      setLeafItems(leaves);
      setProgress(prev => ({ ...prev, total: leaves.length }));
    }
  }, [outlineData, collectLeafItems]);

  // 监听页面滚动，控制回到顶部按钮的显示
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setShowScrollToTop(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 获取叶子节点的实时内容
  const getLeafItemContent = (itemId: string): string | undefined => {
    const leafItem = leafItems.find(leaf => leaf.id === itemId);
    return leafItem?.content;
  };

  // 检查是否为叶子节点
  const isLeafNode = (item: OutlineItem): boolean => {
    return !item.children || item.children.length === 0;
  };

  // 创建Tiptap编辑器
  const editor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({ levels: [1, 2, 3] }),
      Bold,
      Italic,
      Underline,
      Strike,
      Code,
      CodeBlock,
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      HorizontalRule,
      Link.configure({ openOnClick: false }),
      Image,
      Table,
      TableHeader,
      TableRow,
      TableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: '请输入内容...',
      }),
      Markdown,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      setEditContent(content);
      
      // 实时更新leafItems中的内容
      if (editingItemId) {
        setLeafItems(prev => {
          return prev.map(item => {
            if (item.id === editingItemId) {
              return { ...item, content };
            }
            return item;
          });
        });
      }
    },
  });

  // 当outlineData或leafItems变化且处于全文编辑模式时，自动更新编辑器内容
  useEffect(() => {
    if (editingItemId === 'full_content' && editor && outlineData) {
      const fullContent = generateFullContent(outlineData.outline || []);
      editor.commands.setContent(fullContent);
    }
  }, [outlineData, leafItems, editingItemId, editor, generateFullContent]);

  // 开始编辑内容
  const handleStartEdit = (itemId: string, currentContent: string) => {
    setEditingItemId(itemId);
    const safeContent = currentContent || '';
    setEditContent(safeContent);
    
    // 延迟设置编辑器内容，确保编辑器已经初始化
    setTimeout(() => {
      if (editor) {
        // 使用Markdown扩展增强的setContent方法来解析Markdown内容
        editor.commands.setContent(safeContent);
      }
    }, 0);
  };

  // 解析全文内容，将其拆分为各个章节
  const parseFullContent = (content: string): { id: string; title: string; content: string }[] => {
    const sections: { id: string; title: string; content: string }[] = [];
    
    // 使用正则表达式匹配所有章节，包括标题和内容
    // 匹配模式：#、##、### 等不同级别的章节ID 章节标题
    const sectionRegex = /(^#+)\s+(\S+)\s+([^\n]+)\n([\s\S]*?)(?=\n#+\s+\S+\s+[^\n]+\n|$)/g;
    
    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      const id = match[2];
      const title = match[3];
      const contentPart = match[4] ? match[4].trim() : '';
      
      sections.push({ id, title, content: contentPart });
    }
    
    return sections;
  };

  // 保存编辑的内容
  const handleSaveEdit = () => {
    if (!editingItemId) return;

    if (editingItemId === 'full_content') {
      // 全文编辑模式下，将内容拆分为各个章节
      const sections = parseFullContent(editContent);
      
      // 更新本地状态
      const updatedLeafItems = [...leafItems];
      sections.forEach(section => {
        const index = updatedLeafItems.findIndex(item => item.id === section.id);
        if (index !== -1) {
          updatedLeafItems[index] = { ...updatedLeafItems[index], content: section.content };
        }
      });
      setLeafItems(updatedLeafItems);
      
      // 更新outlineData
      if (outlineData && updateOutline) {
        const updateOutlineContent = (items: OutlineItem[]): OutlineItem[] => {
          return items.map(item => {
            const updatedItem = updatedLeafItems.find(ui => ui.id === item.id);
            if (updatedItem) {
              return updatedItem;
            } else if (item.children && item.children.length > 0) {
              return {
                ...item,
                children: updateOutlineContent(item.children)
              };
            } else {
              return item;
            }
          });
        };
        
        const updatedOutline = updateOutlineContent(outlineData.outline || []);
        updateOutline({
          ...outlineData,
          outline: updatedOutline
        });
      }
    } else {
      // 单章节编辑模式下，仅更新当前章节
      setLeafItems(prevItems => {
        return prevItems.map(item => {
          if (item.id === editingItemId) {
            return { ...item, content: editContent };
          }
          return item;
        });
      });
    }

    // 退出编辑模式
    setEditingItemId(null);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingItemId(null);
  };

  // 递归渲染目录树
  const renderOutlineTree = (items: OutlineItem[], expandedItems: Set<string>): React.ReactElement[] => {
    return items.map((item) => {
      const isLeaf = isLeafNode(item);
      const isExpanded = expandedItems.has(item.id);
      const hasChildren = item.children && item.children.length > 0;
      
      return (
        <div key={item.id} className="mb-2">
          {/* 节点标题行 */}
          <div className="flex items-center gap-2 py-1">
            {/* 展开/折叠按钮 */}
            {hasChildren && (
              <button 
                onClick={() => {
                  const newExpanded = new Set(expandedItems);
                  if (isExpanded) {
                    newExpanded.delete(item.id);
                  } else {
                    newExpanded.add(item.id);
                  }
                  setExpandedItems(newExpanded);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg 
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {!hasChildren && <div className="w-4" />}
            
            {/* 节点标题 */}
            <div 
              className={`text-sm font-medium flex-1 cursor-pointer ${selectedChapter === item.id ? 'text-blue-600' : 'text-gray-900 hover:text-blue-500'}`}
              onClick={() => {
                // 进入全文编辑模式
                setEditingItemId('full_content');
                
                // 延迟设置编辑器内容和光标位置，确保编辑器已经初始化
                setTimeout(() => {
                  if (editor && outlineData) {
                    const fullContent = generateFullContent(outlineData.outline || []);
                    
                    // 设置编辑器内容
                    editor.commands.setContent(fullContent);
                    
                    // 定位到对应章节标题的末尾
                    const chapterTitle = `${item.id} ${item.title}`;
                    const content = editor.getHTML();
                    const titleRegex = new RegExp(`(<h[1-3]>[^<]*${chapterTitle}[^<]*<\/h[1-3]>)`, 'i');
                    const match = content.match(titleRegex);
                    
                    if (match) {
                      // 计算标题的结束位置
                      const titlePosition = content.indexOf(match[1]) + match[1].length;
                      
                      // 将光标移动到标题末尾
                      editor.commands.setTextSelection(titlePosition);
                      editor.commands.focus();
                    }
                  }
                }, 0);
              }}
            >
              {item.id} {item.title}
            </div>
            
            {/* 操作按钮组 */}
            <div className="flex items-center gap-1 ml-2">
              {/* 新增子目录按钮 */}
              <button
                onClick={() => handleAddSubChapter(item.id)}
                className="p-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                title="新增子目录"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              
              {/* 编辑和生成按钮 - 仅叶子节点显示 */}
              {isLeaf && (
                <>
                  <button
                    onClick={() => handleStartEdit(item.id, getLeafItemContent(item.id) || '')}
                    className="p-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                    title="编辑内容"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleGenerateContentForItem(item)}
                    disabled={progress.generating.has(item.id)}
                    className={`p-1 text-xs ${progress.generating.has(item.id) ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:text-green-800 hover:bg-green-50 rounded'}`}
                    title="生成内容"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                </>
              )}
              
              {/* 删除按钮 */}
              <button
                onClick={() => handleDeleteChapter(item.id)}
                className="p-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                title="删除目录"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* 子节点 */}
            {hasChildren && isExpanded && (
              <div className="pl-6 mt-1 border-l-2 border-gray-100">
                {renderOutlineTree(item.children || [], expandedItems)}
              </div>
            )}
        </div>
      );
    });
  };
  
  // 渲染完整的目录结构
  const renderOutline = (): React.ReactElement => {
    if (!outlineData?.outline) return <div>加载中...</div>;
    
    return (
      <div className="w-full max-w-full mx-auto bg-white p-6 rounded-lg shadow-md">
        
        {/* 主要内容区域 */}
        <div className="flex gap-6">
          {/* 左侧目录树 */}
          <div className="w-72 bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-y-auto max-h-[calc(100vh-200px)]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">目录</h2>
            {renderOutlineTree(outlineData.outline, expandedItems)}
          </div>
          
          {/* 右侧编辑区域 */}
          <div className="flex-1 bg-white p-4 rounded-lg border border-gray-200">
            {/* 当前选中的章节内容 */}
            {selectedChapter || editingItemId === 'full_content' ? (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingItemId === 'full_content' ? '全文编辑' : getChapterTitle(selectedChapter || '')}
                </h2>
                
                {/* 编辑模式 - 支持单章节编辑和全文编辑 */}
                {editingItemId === selectedChapter || editingItemId === 'full_content' ? (
                  <div>
                    <div className="mb-4">
                      <div className="border border-gray-200 rounded-md overflow-hidden">
                        {/* 编辑器工具栏 */}
                        {editor && (
                          <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 border-b border-gray-200">
                            {/* 格式设置 */}
                            <div className="flex items-center gap-1">
                              <select 
                                className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '0') {
                                    editor.commands.setParagraph();
                                  } else {
                                    editor.commands.toggleHeading({ level: parseInt(value) as 1 | 2 | 3 });
                                  }
                                }}
                                value={editor.isActive('heading', { level: 1 }) ? '1' : 
                                       editor.isActive('heading', { level: 2 }) ? '2' : 
                                       editor.isActive('heading', { level: 3 }) ? '3' : '0'}
                              >
                                <option value="0">段落</option>
                                <option value="1">标题 1</option>
                                <option value="2">标题 2</option>
                                <option value="3">标题 3</option>
                              </select>
                            </div>
                            
                            <div className="border-r border-gray-300 h-6"></div>
                            
                            {/* 文本样式 */}
                            <div className="flex items-center gap-1">
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().toggleBold().run()}
                                title="粗体"
                              >
                                <strong>B</strong>
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().toggleItalic().run()}
                                title="斜体"
                              >
                                <em>I</em>
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().toggleUnderline().run()}
                                title="下划线"
                              >
                                <u>U</u>
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive('strike') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().toggleStrike().run()}
                                title="删除线"
                              >
                                <s>S</s>
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive('code') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().toggleCode().run()}
                                title="行内代码"
                              >
                                <code>{`</>`}</code>
                              </button>
                            </div>
                            
                            <div className="border-r border-gray-300 h-6"></div>
                            
                            {/* 列表 */}
                            <div className="flex items-center gap-1">
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                                title="无序列表"
                              >
                                • 列表
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                title="有序列表"
                              >
                                1. 列表
                              </button>
                            </div>
                            
                            <div className="border-r border-gray-300 h-6"></div>
                            
                            {/* 其他格式 */}
                            <div className="flex items-center gap-1">
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive('blockquote') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                                title="引用"
                              >
                                ""
                              </button>
                              <button
                                className="px-2 py-1 text-sm rounded hover:bg-gray-200"
                                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                                title="分割线"
                              >
                                —
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive('codeBlock') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                                title="代码块"
                              >
                                代码块
                              </button>
                            </div>
                            
                            <div className="border-r border-gray-300 h-6"></div>
                            
                            {/* 对齐方式 */}
                            <div className="flex items-center gap-1">
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                                title="左对齐"
                              >
                                左
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                                title="居中对齐"
                              >
                                中
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                                title="右对齐"
                              >
                                右
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive({ textAlign: 'justify' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                                title="两端对齐"
                              >
                                齐
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* 编辑器内容区域 */}
                        <EditorContent 
                          editor={editor} 
                          className="prose max-w-none"
                          style={{ minHeight: '600px', padding: '10px' }}
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveEdit}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        保存
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {selectedChapter && getLeafItemContent(selectedChapter) ? (
                      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: getLeafItemContent(selectedChapter) || '' }}>
                      </div>
                    ) : (
                      <div className="text-gray-400 italic py-4">
                        <DocumentTextIcon className="inline w-4 h-4 mr-2" />
                        {selectedChapter && progress.generating.has(selectedChapter) ? (
                          <span className="text-blue-600">正在生成内容...</span>
                        ) : (
                          '内容待生成...'
                        )}
                      </div>
                    )}
                    {/* 编辑按钮 */}
                    {selectedChapter && getLeafItemContent(selectedChapter) && !progress.generating.has(selectedChapter) && (
                      <button
                        onClick={() => handleStartEdit(selectedChapter, getLeafItemContent(selectedChapter) || '')}
                        className="mt-2 inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        编辑
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 italic py-8 text-center">
                <DocumentTextIcon className="inline w-8 h-8 mr-2 text-gray-400" />
                <p>请从左侧目录中选择一个章节</p>
              </div>
            )}
          </div>
          
          {/* 右侧知识素材面板 */}
          <div className="w-64 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">默认知识库</h2>
            <div className="mb-4">
              <input
                type="text"
                placeholder="搜索图片或表格"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button className="w-full py-2 text-sm text-center text-white bg-purple-500 rounded-md hover:bg-purple-600">
              插入选中素材 (0)
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // 根据章节ID获取章节标题
  const getChapterTitle = (chapterId: string): string => {
    const findChapter = (items: OutlineItem[]): OutlineItem | null => {
      for (const item of items) {
        if (item.id === chapterId) return item;
        if (item.children) {
          const found = findChapter(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const chapter = findChapter(outlineData?.outline || []);
    return chapter ? chapter.title : '未知章节';
  };
  
  // 生成单个章节内容
  const handleGenerateContentForItem = async (item: OutlineItem) => {
    if (!outlineData) return;
    await generateItemContent(item, outlineData.project_overview || '');
  };
  
  // 获取总字数
  const getTotalWordCount = (): number => {
    let totalCount = 0;
    leafItems.forEach(item => {
      if (item.content) {
        // 简单的字数统计，实际项目中可能需要更准确的实现
        totalCount += item.content.replace(/\s+/g, ' ').trim().length;
      }
    });
    return totalCount;
  };
  
  // 目录展开状态管理
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // 初始化时展开所有一级目录
  useEffect(() => {
    if (outlineData?.outline) {
      const initialExpanded = new Set<string>();
      outlineData.outline.forEach(item => {
        initialExpanded.add(item.id);
      });
      setExpandedItems(initialExpanded);
    }
  }, [outlineData?.outline]);

  // 生成单个章节内容
  const generateItemContent = async (item: OutlineItem, projectOverview: string): Promise<OutlineItem> => {
    if (!outlineData) throw new Error('缺少目录数据');
    
    // 将当前项目添加到正在生成的集合中
    setProgress(prev => ({ 
      ...prev, 
      current: item.title,
      generating: new Set([...Array.from(prev.generating), item.id])
    }));
    
    try {
      // 获取上级章节和同级章节信息
      const parentChapters = getParentChapters(item.id, outlineData.outline);
      const siblingChapters = getSiblingChapters(item.id, outlineData.outline);

      const request: ChapterContentRequest = {
        chapter: item,
        parent_chapters: parentChapters,
        sibling_chapters: siblingChapters,
        project_overview: projectOverview
      };

      const response = await contentApi.generateChapterContentStream(request);

      if (!response.ok) throw new Error('生成失败');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      let content = '';
      const updatedItem = { ...item };
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              
              if ((parsed.status === 'streaming' && parsed.full_content) || (parsed.status === 'completed' && parsed.content)) {
                // 获取新内容
                const newContent = parsed.status === 'streaming' ? parsed.full_content : parsed.content;
                
                // 确保内容是有效的HTML
                let safeContent = newContent;
                try {
                  // 如果内容包含HTML标签，确保它是有效的
                  if (safeContent && (safeContent.includes('<') || safeContent.includes('>'))) {
                    // 使用DOMParser检查HTML的有效性
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(safeContent, 'text/html');
                    
                    // 如果解析失败，使用纯文本内容
                    if (doc.querySelector('parsererror')) {
                      safeContent = newContent
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    }
                  }
                } catch (error) {
                  console.error('解析HTML内容失败:', error);
                  // 出错时使用纯文本内容
                  safeContent = newContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                }
                
                // 更新内容
                content = safeContent;
                updatedItem.content = safeContent;
                
                // 实时更新叶子节点数据以触发重新渲染
                setLeafItems(prevItems => {
                  const newItems = [...prevItems];
                  const index = newItems.findIndex(i => i.id === item.id);
                  if (index !== -1) {
                    newItems[index] = { ...updatedItem };
                  }
                  return newItems;
                });
                
                // 实时更新编辑器内容（如果处于全文编辑模式）
                if (editingItemId === 'full_content' && editor && outlineData) {
                  const fullContent = generateFullContent(outlineData.outline || []);
                  editor.commands.setContent(fullContent);
                }
              } else if (parsed.status === 'error') {
                throw new Error(parsed.message);
              }
            } catch (e) {
              // 忽略JSON解析错误
            }
          }
        }
      }

      return updatedItem;
    } catch (error) {
      setProgress(prev => ({
        ...prev,
        failed: [...prev.failed, item.title]
      }));
      throw error;
    } finally {
      // 从正在生成的集合中移除当前项目
      setProgress(prev => {
        const newGenerating = new Set(Array.from(prev.generating));
        newGenerating.delete(item.id);
        return {
          ...prev,
          generating: newGenerating
        };
      });
    }
  };

  // 生成目录结构
  const generateTableOfContents = (items: OutlineItem[], level: number = 1): string => {
    let toc = '';
    for (const item of items) {
      // 根据层级添加对应的Markdown标题样式
      const headingMarkers = '#'.repeat(level);
      toc += `${headingMarkers} ${item.id} ${item.title}\n`;
      if (item.children && item.children.length > 0) {
        toc += generateTableOfContents(item.children, level + 1);
      }
    }
    return toc;
  };

  // 开始生成所有内容
  const handleGenerateContent = async () => {
    if (!outlineData || leafItems.length === 0) return;

    setIsGenerating(true);
    setProgress({
      total: leafItems.length,
      completed: 0,
      current: '',
      failed: [],
      generating: new Set<string>()
    });

    try {
      // 立即进入全文编辑模式
      const initialFullContent = generateFullContent(outlineData.outline || []);
      setEditContent(initialFullContent);
      setEditingItemId('full_content'); // 使用特殊ID表示全文编辑模式
      
      // 延迟设置初始编辑器内容，确保编辑器已经初始化
      setTimeout(() => {
        if (editor) {
          // 使用Markdown扩展增强的setContent方法来解析Markdown内容
          editor.commands.setContent(initialFullContent);
        }
      }, 0);
      
      // 使用5个并发线程生成内容
      const concurrency = 5;
      const updatedItems = [...leafItems];
      
      for (let i = 0; i < leafItems.length; i += concurrency) {
        const batch = leafItems.slice(i, i + concurrency);
        const promises = batch.map(item => 
          generateItemContent(item, outlineData.project_overview || '')
            .then(updatedItem => {
              const index = updatedItems.findIndex(ui => ui.id === updatedItem.id);
              if (index !== -1) {
                updatedItems[index] = updatedItem;
              }
              setProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
              return updatedItem;
            })
            .catch(error => {
              console.error(`生成内容失败 ${item.title}:`, error);
              setProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
              return item; // 返回原始项目
            })
        );

        await Promise.all(promises);
      }

      // 更新状态
      setLeafItems(updatedItems);
      
      // 如果当前有选中的章节，更新editContent，确保UI立即反映变化
      if (selectedChapter) {
        const selectedItem = updatedItems.find(item => item.id === selectedChapter);
        if (selectedItem?.content) {
          setEditContent(selectedItem.content);
        }
      }
      
      // 更新整个outlineData，确保UI能够正确显示生成的内容
      if (outlineData && updateOutline) {
        // 递归更新outlineData中的内容
        const updateOutlineContent = (items: OutlineItem[]): OutlineItem[] => {
          return items.map(item => {
            const updatedItem = updatedItems.find(ui => ui.id === item.id);
            if (updatedItem) {
              return updatedItem;
            } else if (item.children && item.children.length > 0) {
              return {
                ...item,
                children: updateOutlineContent(item.children)
              };
            } else {
              return item;
            }
          });
        };
        
        const updatedOutline = updateOutlineContent(outlineData.outline || []);
        updateOutline({
          ...outlineData,
          outline: updatedOutline
        });
      }
      
    } catch (error) {
      console.error('生成内容时出错:', error);
    } finally {
      setIsGenerating(false);
      setProgress(prev => ({ ...prev, current: '', generating: new Set<string>() }));
    }
  };

  // 获取叶子节点的最新内容（包括生成的内容）
  const getLatestContent = (item: OutlineItem): string => {
    if (item.id === editingItemId) {
      return editContent;
    } else if (item.children && item.children.length > 0) {
      // 递归获取第一个有内容的子项
      for (const child of item.children) {
        const content = getLatestContent(child);
        if (content) {
          return content;
        }
      }
      return '';
    }
    return item.content || '';
  };

  // 滚动到页面顶部
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 导出Word文档
  const handleExportWord = async () => {
    if (!outlineData) return;

    try {
      // 构建带有最新内容的导出数据（leafItems 中存的是实时内容）
      const buildExportOutline = (items: OutlineItem[]): OutlineItem[] => {
        return items.map(item => {
          const isLeaf = !item.children || item.children.length === 0;
          const latestContent = getLatestContent(item);
          const exportedItem: OutlineItem = {
            ...item,
            content: latestContent,
          };
          if (item.children && item.children.length > 0) {
            exportedItem.children = buildExportOutline(item.children);
          }
          return exportedItem;
        });
      };

      const exportPayload = {
        project_name: outlineData.project_name,
        project_overview: outlineData.project_overview,
        outline: buildExportOutline(outlineData.outline),
      };

      const response = await documentApi.exportWord(exportPayload);
      if (!response.ok) {
        throw new Error('导出失败');
      }
      const blob = await response.blob();
      saveAs(blob, `${outlineData.project_name || '标书文档'}.docx`);
      
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    }
  };

  if (!outlineData) {
    return (
      <div className="w-full max-w-full mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">暂无内容</h3>
            <p className="mt-1 text-sm text-gray-500">
              请先在"目录编辑"步骤中生成目录结构
            </p>
          </div>
        </div>
      </div>
    );
  }

  const completedItems = leafItems.filter(item => item.content).length;

  return (
    <div className="w-full max-w-full mx-auto">
      {/* 顶部工具栏 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">标书内容</h2>
              <p className="text-sm text-gray-500 mt-1">
                共 {leafItems.length} 个章节，已生成 {completedItems} 个
                {progress.failed.length > 0 && (
                  <span className="text-red-500 ml-2">失败 {progress.failed.length} 个</span>
                )}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleGenerateContent}
                disabled={isGenerating}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayIcon className="w-4 h-4 mr-2" />
                {isGenerating ? '生成中...' : '生成标书'}
              </button>
              
              <button
                onClick={handleExportWord}
                disabled={isGenerating}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                导出Word
              </button>
            </div>
          </div>
          
          {/* 进度条 */}
          {isGenerating && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>正在生成: {progress.current}</span>
                <span>{progress.completed} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 文档内容 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-8">
          <div className="prose max-w-none">
            {/* 文档标题 */}
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              {outlineData.project_name || '投标技术文件'}
            </h1>
            
            {/* 项目概述 */}
            {outlineData.project_overview && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-8">
                <h2 className="text-lg font-semibold text-blue-900 mb-2">项目概述</h2>
                <p className="text-blue-800">{outlineData.project_overview}</p>
              </div>
            )}

            {/* 目录结构和内容 */}
            <div className="space-y-8">
              {renderOutline()}
            </div>
          </div>
        </div>
      </div>

      {/* 底部统计 */}
      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <CheckCircleIcon className="w-4 h-4 text-green-500 mr-1" />
              <span>已完成: {completedItems}</span>
            </div>
            <div className="flex items-center">
              <DocumentTextIcon className="w-4 h-4 text-gray-400 mr-1" />
              <span>待生成: {leafItems.length - completedItems}</span>
            </div>
            {progress.failed.length > 0 && (
              <div className="flex items-center">
                <ExclamationCircleIcon className="w-4 h-4 text-red-500 mr-1" />
                <span className="text-red-600">失败: {progress.failed.length}</span>
              </div>
            )}
          </div>
          <div>
            <span>总字数: {leafItems.reduce((sum, item) => sum + (item.content?.length || 0), 0)}</span>
          </div>
        </div>
      </div>

      {/* 回到顶部按钮 */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all duration-300 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-50"
          aria-label="回到顶部"
        >
          <ArrowUpIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default ContentEdit;