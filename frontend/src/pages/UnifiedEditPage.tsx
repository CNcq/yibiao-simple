/**
 * 统一编辑页面 - 整合正文编辑和全文编辑功能
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

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
import { PlayIcon, DocumentArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import { contentApi, ChapterContentRequest, documentApi, knowledgeBaseApi } from '../services/api';
import { saveAs } from 'file-saver';

interface KnowledgeBaseGroup {
  name: string;
  description: string;
  document_count: number;
}

interface UnifiedEditPageProps {
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

const UnifiedEditPage: React.FC<UnifiedEditPageProps> = ({
  outlineData,
  selectedChapter,
  onChapterSelect,
  updateOutline,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false); // 新增流式状态变量
  const [progress, setProgress] = useState<GenerationProgress>({
    total: 0,
    completed: 0,
    current: '',
    failed: [],
    generating: new Set<string>()
  });
  const [leafItems, setLeafItems] = useState<OutlineItem[]>([]);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isGeneratingChapter, setIsGeneratingChapter] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [knowledgeBaseGroups, setKnowledgeBaseGroups] = useState<KnowledgeBaseGroup[]>([]);
  const [selectedKnowledgeBaseGroup, setSelectedKnowledgeBaseGroup] = useState<string>('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  

  
  // 章节要求输入状态
  const [chapterRequirements, setChapterRequirements] = useState<Record<string, string>>({});
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  // 确认删除状态
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; chapterId: string | null; chapterTitle: string }>({ 
    visible: false, 
    chapterId: null, 
    chapterTitle: '' 
  });

  
  // 使用ref跟踪outlineData和editor的最新值
  const outlineDataRef = useRef(outlineData);
  const editorRef = useRef<any>(null);
  
  // 用于取消生成的控制器引用
  const generationControllersRef = useRef<Record<string, AbortController>>({});
  
  // 安全获取编辑器实例的辅助函数 - 稍后定义
  
  // 收集所有叶子节点
  const collectLeafItems = useCallback((items: OutlineItem[]): OutlineItem[] => {
    let leaves: OutlineItem[] = [];
    items.forEach(item => {
      // 如果章节被标记为不可见（已删除），则跳过
      if (item.visible === false) {
        return;
      }
      
      if (!item.children || item.children.length === 0) {
        leaves.push(item);
      } else {
        leaves = leaves.concat(collectLeafItems(item.children));
      }
    });
    return leaves;
  }, []);

  // 生成完整的Markdown内容
  const generateFullContent = useCallback((): string => {
    if (!outlineData?.outline) return '';
    
    const leafItems = collectLeafItems(outlineData.outline);
    
    return leafItems.map(item => {
      // 只生成可见章节的内容
      if (item.visible === false) return '';
      
      return `# ${item.title}

${item.content || '内容尚未生成'}

`;
    }).join('');
  }, [outlineData, collectLeafItems]);

  // 将编辑器内容同步回outlineData
  const syncEditorContentToOutline = useCallback(() => {
    // 直接使用editorRef.current，避免依赖getEditorInstance函数
    const editor = editorRef.current;
    if (!editor || !outlineDataRef.current?.outline) return;
    
    try {
      // 获取编辑器内容（HTML格式）
      const htmlContent = editor.getHTML();
      
      // 创建一个临时的DOM元素来解析HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      
      // 获取所有的h1元素（章节标题）
      const h1Elements = tempDiv.querySelectorAll('h1');
      const chapters: { title: string; content: string }[] = [];
      
      h1Elements.forEach(h1 => {
        // 获取章节标题
        const title = h1.textContent?.trim() || '';
        
        // 获取章节内容（h1之后的所有内容，直到下一个h1或结束）
        let content = '';
        let nextSibling = h1.nextSibling;
        
        while (nextSibling && nextSibling.nodeName !== 'H1') {
          if (nextSibling.nodeType === Node.ELEMENT_NODE) {
            content += (nextSibling as HTMLElement).outerHTML;
          } else if (nextSibling.nodeType === Node.TEXT_NODE) {
            content += nextSibling.textContent;
          }
          nextSibling = nextSibling.nextSibling;
        }
        
        chapters.push({
          title,
          content: content.trim()
        });
      });
      
      // 更新outlineData中的章节内容
      let updatedOutline = [...outlineDataRef.current.outline];
      
      // 递归更新函数
      const updateContentInOutline = (items: OutlineItem[], chapters: { title: string; content: string }[]): OutlineItem[] => {
        return items.map(item => {
          if (!item.children || item.children.length === 0) {
            // 叶子节点，查找对应的章节内容
            const chapter = chapters.find(ch => ch.title === item.title);
            if (chapter) {
              return {
                ...item,
                content: chapter.content
              };
            }
            return item;
          } else {
            // 非叶子节点，递归更新子节点
            return {
              ...item,
              children: updateContentInOutline(item.children, chapters)
            };
          }
        });
      };
      
      // 更新outlineData
      updatedOutline = updateContentInOutline(updatedOutline, chapters);
      
      // 调用updateOutline函数更新父组件状态
      updateOutline({
        ...outlineDataRef.current,
        outline: updatedOutline
      });
      
    } catch (error) {
      console.error('同步编辑器内容到outline失败:', error);
    }
  // 注意：getEditorInstance函数现在在这个函数之后定义，所以需要更新依赖数组
  }, [updateOutline]);

  // 初始化Tiptap编辑器
  const editor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
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
      Link.configure({
        openOnClick: true,
      }),
      Image,
      Table.configure({
        resizable: true,
      }),
      TableHeader,
      TableRow,
      TableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: '内容尚未生成',
      }),
      Markdown,
    ],
    content: generateFullContent(),
    editable: true,
    onUpdate: ({ editor }) => {
      // 流式更新期间禁用同步，避免冲突
      if (!isStreaming) {
        syncEditorContentToOutline();
      }
    },
  });

  // 更新叶子节点列表
  useEffect(() => {
    if (outlineData?.outline) {
      const leaves = collectLeafItems(outlineData.outline);
      setLeafItems(leaves);
    } else {
      setLeafItems([]);
    }
  }, [outlineData, collectLeafItems]);

  // 更新outlineDataRef
  useEffect(() => {
    outlineDataRef.current = outlineData;
  }, [outlineData]);
  
  // 更新editorRef，确保始终指向最新的编辑器实例
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  // 安全获取编辑器实例的辅助函数
  const getEditorInstance = useCallback((): any => {
    // 优先使用最新的editor变量
    if (editor) {
      return editor;
    }
    // 否则使用ref中保存的实例
    return editorRef.current;
  }, [editor]);

  // 获取知识库分组
  useEffect(() => {
    const fetchKnowledgeBaseGroups = async () => {
      try {
        setIsLoadingGroups(true);
        const response = await knowledgeBaseApi.getKnowledgeBaseGroups();
        if (response.data && Array.isArray(response.data.groups)) {
          setKnowledgeBaseGroups(response.data.groups);
          // 默认选择第一个分组
          if (response.data.groups.length > 0) {
            setSelectedKnowledgeBaseGroup(response.data.groups[0].name);
          }
        }
      } catch (error) {
        console.error('获取知识库分组失败:', error);
        setError('获取知识库分组失败');
      } finally {
        setIsLoadingGroups(false);
      }
    };

    fetchKnowledgeBaseGroups();
  }, []);

  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 内容匹配与融合算法
  const matchAndFuseContent = (userRequirement: string, knowledgeBaseReferences: any[], chapterTitle: string): string => {
    // 如果没有用户要求和知识库参考，返回基本提示
    if (!userRequirement && knowledgeBaseReferences.length === 0) {
      return `请生成"${chapterTitle}"章节的详细内容。`;
    }
    
    let promptContent = '';
    
    // 1. 优先级最高：用户明确要求
    if (userRequirement) {
      // 分析用户要求的关键信息
      const requirementKeywords = userRequirement.split(/\s+/) 
        .filter(word => word.length > 2) 
        .map(word => word.toLowerCase());
      
      promptContent += `用户对本章"${chapterTitle}"的明确要求：\n${userRequirement}\n\n`;
      
      // 2. 从知识库中筛选最相关的参考资料
      if (knowledgeBaseReferences.length > 0) {
        // 计算每个参考资料与用户要求的相关度
        const sortedReferences = [...knowledgeBaseReferences].sort((a, b) => {
          const aSummary = (a.summary || '').toLowerCase();
          const bSummary = (b.summary || '').toLowerCase();
          
          const aRelevance = requirementKeywords.filter(keyword => aSummary.includes(keyword)).length;
          const bRelevance = requirementKeywords.filter(keyword => bSummary.includes(keyword)).length;
          
          return bRelevance - aRelevance;
        });
        
        // 最多使用前5个最相关的参考资料
        const topReferences = sortedReferences.slice(0, 5);
        
        promptContent += `与用户要求最相关的知识库参考资料：\n`;
        topReferences.forEach((ref, index) => {
          promptContent += `${index + 1}. ${ref.title || '无标题参考资料'}\n   摘要：${ref.summary || '无摘要'}\n\n`;
        });
      }
    } 
    // 如果没有用户要求，但有知识库参考
    else if (knowledgeBaseReferences.length > 0) {
      promptContent += `基于知识库资料生成"${chapterTitle}"章节的详细内容：\n\n`;
      knowledgeBaseReferences.slice(0, 5).forEach((ref, index) => {
        promptContent += `${index + 1}. ${ref.title || '无标题参考资料'}\n   摘要：${ref.summary || '无摘要'}\n\n`;
      });
    }
    
    // 3. 添加最终指令
    promptContent += `请基于以上信息，生成结构清晰、逻辑严谨的章节内容，确保：\n`;
    promptContent += `1. 严格遵循用户要求（如果有）\n`;
    promptContent += `2. 充分利用相关的知识库参考资料\n`;
    promptContent += `3. 内容与章节标题"${chapterTitle}"高度相关\n`;
    promptContent += `4. 语言流畅，适合目标读者阅读\n`;
    
    return promptContent;
  };

  // 基于知识库为单个章节生成内容（支持流式输出）
  const generateChapterContent = async (item: OutlineItem): Promise<boolean> => {
    const currentOutlineData = outlineDataRef.current;
    if (!currentOutlineData) return false;
    
    setIsStreaming(true); // 开始流式更新，禁用同步
    setIsGeneratingChapter(prev => new Set(prev).add(item.id));
    setError(null);
    
    // 设置章节的生成状态为loading
    if (currentOutlineData) {
      const updatedOutline = updateItemContent(currentOutlineData.outline, item.id, '正在生成内容...');
      updateOutline({
        ...currentOutlineData,
        outline: updatedOutline
      });
    }
    
    // 创建控制器用于取消请求
    const controller = new AbortController();
    const { signal } = controller;
    
    // 存储控制器以便后续取消
    generationControllersRef.current[item.id] = controller;
    
    // 重试次数计数器
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1秒
    
    // 保存已生成的内容，用于恢复
    let savedGeneratedContent = '';
    
    // 防抖机制：延迟更新编辑器内容，减少DOM操作次数
    const DEBOUNCE_DELAY = 100; // 100毫秒的防抖延迟
    let updateTimeoutId: NodeJS.Timeout | null = null;
    
    // 记录上一次更新的内容，用于增量更新
    let lastUpdatedContent = '';
    
    // 初始化流式内容变量，确保在整个函数范围内可访问
    let generatedContent = savedGeneratedContent;
    
    // 防抖更新编辑器内容的函数
    const debouncedUpdateEditor = async (content: string) => {
      if (updateTimeoutId) {
        clearTimeout(updateTimeoutId);
      }
      updateTimeoutId = setTimeout(async () => {
        const editorInstance = getEditorInstance();
        if (editorInstance && content !== lastUpdatedContent) {
          // 使用更高效的局部更新方法，只更新当前章节的内容
          try {
            const { state } = editorInstance;
            const { doc } = state;
            
            // 查找当前章节的h1标题，使用更灵活的匹配方式
            let chapterTitlePos = -1;
            let chapterTitleNode: any = null;
            
            doc.descendants((node: any, pos: number) => {
              if (node.type.name === 'heading' && node.attrs.level === 1) {
                // 去除首尾空格后比较，避免格式化差异导致匹配失败
                if (node.textContent.trim() === item.title.trim()) {
                  chapterTitlePos = pos;
                  chapterTitleNode = node;
                  return false; // 停止查找
                }
              }
              return true;
            });
            
            if (chapterTitlePos !== -1 && chapterTitleNode) {
              // 找到标题后，计算内容开始位置
              const contentStartPos = chapterTitlePos + chapterTitleNode.nodeSize;
              let contentEndPos = doc.content.size; // 默认到文档结尾
              
              // 查找当前章节之后的下一个h1标题
              doc.descendants((node: any, pos: number) => {
                // 只查找当前章节之后的节点
                if (pos > chapterTitlePos) {
                  if (node.type.name === 'heading' && node.attrs.level === 1) {
                    contentEndPos = pos;
                    return false; // 停止查找
                  }
                }
                return true;
              });
              
              // 直接更新编辑器内容，不依赖outlineData状态
              if (contentEndPos > contentStartPos) {
                // 先删除旧内容，再插入新内容
                await editorInstance
                  .chain()
                  .focus()
                  .deleteRange({ from: contentStartPos, to: contentEndPos })
                  .insertContentAt(contentStartPos, content)
                  .run();
              } else {
                // 没有旧内容，直接在标题后插入新内容
                await editorInstance
                  .chain()
                  .focus()
                  .insertContentAt(contentStartPos, content)
                  .run();
              }
            } else {
              // 找不到章节，可能是新章节，直接追加
              await editorInstance.commands.insertContent(`<h1>${item.title}</h1>${content}`);
            }
          } catch (err) {
            console.error('局部更新失败，回退到更健壮的更新方式:', err);
            // 回退到更健壮的更新方式，但仍保持实时性
            try {
              // 尝试更简单的方式：查找章节标题并替换其内容
              await editorInstance.chain().focus().run();
              
              // 先查找是否存在该章节的标题
              const contentHtml = editorInstance.getHTML();
              const titleRegex = new RegExp(`(<h1[^>]*>${item.title.trim()}</h1>)(.|\r\n)*?(?=<h1[^>]*>|$)`, 'i');
              const match = contentHtml.match(titleRegex);
              
              if (match) {
                // 替换章节内容
                const newContent = contentHtml.replace(titleRegex, `$1${content}`);
                await editorInstance.commands.setContent(newContent, { parseOptions: { preserveWhitespace: true } });
              } else {
                // 找不到章节标题，直接追加
                await editorInstance.commands.insertContent(`<h1>${item.title}</h1>${content}`);
              }
            } catch (fallbackErr) {
              console.error('所有更新方式均失败:', fallbackErr);
              // 保持lastUpdatedContent不变，避免无限重试
              return false;
            }
          }
          
          lastUpdatedContent = content;
        }
      }, DEBOUNCE_DELAY);
    };
    
    try {
      // 1. 基于章节名称搜索知识库，使用选定的知识库分组
      const kbResults = await knowledgeBaseApi.searchKnowledgeBase(item.title, 10, selectedKnowledgeBaseGroup);
      const knowledgeBaseReferences = kbResults.data.results || [];
      
      // 2. 获取用户对当前章节的要求
      const userRequirement = chapterRequirements[item.id] || item.prompt || '';
      
      // 3. 使用内容匹配与融合算法准备提示词
      const fusedPrompt = matchAndFuseContent(userRequirement, knowledgeBaseReferences, item.title);
      
      const request: ChapterContentRequest = {
        chapter: item,
        project_overview: currentOutlineData.project_overview || '',
        prompt: fusedPrompt || undefined
      };
      
      // 4. 调用流式生成API，传递信号以支持取消和重试
      let response;
      for (let currentRetry = retryCount; currentRetry <= maxRetries; currentRetry++) {
        try {
          response = await contentApi.generateChapterContentStream(request, signal);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`流式请求失败: ${errorText || response.statusText}`);
          }
          break; // 请求成功，退出重试循环
        } catch (err) {
          if (currentRetry >= maxRetries) {
            throw err; // 超过最大重试次数，抛出错误
          }
          // 短暂延迟后重试
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, currentRetry)));
        }
      }
      
      // 5. 处理流式响应
      const reader = response?.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }
      
      // 6. 初始化流式内容变量已在函数顶部声明
      let partialChunk = '';
      const decoder = new TextDecoder('utf-8');
      
      // 8. 逐个处理流块
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // 解析流数据
          const chunk = decoder.decode(value, { stream: true });
          
          // 合并可能不完整的JSON块
          const combinedChunk = partialChunk + chunk;
          
          // 处理可能的多JSON对象流 - 使用更可靠的方式处理JSON块
          let jsonChunks: string[] = [];
          let currentJson = '';
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          
          // 逐个字符分析，确保正确识别完整的JSON对象
          for (let i = 0; i < combinedChunk.length; i++) {
            const char = combinedChunk[i];
            
            // 处理字符串和转义字符
            if (char === '"' && !escapeNext) {
              inString = !inString;
            }
            
            if (char === '\\' && escapeNext) {
              escapeNext = false;
            } else if (char === '\\' && inString) {
              escapeNext = true;
            } else {
              escapeNext = false;
            }
            
            if (!inString && !escapeNext) {
              // 统计花括号数量以确定JSON对象边界
              if (char === '{') {
                braceCount++;
              } else if (char === '}') {
                braceCount--;
              }
            }
            
            currentJson += char;
            
            // 当我们找到一个完整的JSON对象时
            if (!inString && !escapeNext && braceCount === 0 && currentJson.trim()) {
              jsonChunks.push(currentJson);
              currentJson = '';
            }
          }
          
          // 最后一个不完整的JSON块保存到下一轮处理
          partialChunk = currentJson;
          
          for (const jsonChunk of jsonChunks.filter(Boolean)) {
            try {
              const data = JSON.parse(jsonChunk);
              if (data.content) {
                generatedContent += data.content;
                savedGeneratedContent = generatedContent; // 保存已生成的内容，用于恢复
                
                // 9. 实时更新章节内容
                const latestOutlineData = outlineDataRef.current;
                if (latestOutlineData) {
                  const updatedOutline = updateItemContent(latestOutlineData.outline, item.id, generatedContent);
                  
                  // 10. 更新状态
                  updateOutline({
                    ...latestOutlineData,
                    outline: updatedOutline
                  });
                  
                  // 11. 使用防抖机制更新编辑器内容，减少DOM操作次数
                  debouncedUpdateEditor(generatedContent);
                }
              }
            } catch (err) {
              console.error('解析流式数据失败:', err);
              // 记录错误但继续处理，避免单个JSON解析失败导致整个生成过程中断
              // 向用户显示警告信息，但不中断生成过程
              if (err instanceof Error && err.message.includes('Unexpected token')) {
                // 这可能是因为JSON格式不完整，尝试恢复处理
                console.log('尝试恢复流式数据处理...');
              }
            }
          }
        }
      } catch (err) {
        console.error('处理流数据失败:', err);
        // 增强错误处理：如果有部分生成的内容，确保显示给用户
        if (savedGeneratedContent) {
          const latestOutlineData = outlineDataRef.current;
          if (latestOutlineData) {
            const updatedOutline = updateItemContent(latestOutlineData.outline, item.id, savedGeneratedContent);
            updateOutline({
              ...latestOutlineData,
              outline: updatedOutline
            });
            // 立即更新编辑器，不使用防抖
            const editorInstance = getEditorInstance();
            if (editorInstance) {
              try {
                await editorInstance.commands.focus();
                await debouncedUpdateEditor(savedGeneratedContent);
              } catch (updateErr) {
                console.error('更新编辑器失败:', updateErr);
              }
            }
          }
        }
        // 向用户显示错误信息
        if (err instanceof Error && err.name !== 'AbortError') {
          const errorMsg = err.message.includes('network') || err.message.includes('fetch') 
            ? '网络连接中断，请检查网络后重试' 
            : `处理流数据失败: ${err.message}`;
          setError(errorMsg);
        }
      }
      
      // 处理最后可能剩余的部分
      if (partialChunk.trim()) {
        try {
          // 尝试解析剩余的JSON块
          const data = JSON.parse(partialChunk);
          if (data.content) {
            generatedContent += data.content;
            savedGeneratedContent = generatedContent; // 保存已生成的内容
            const latestOutlineData = outlineDataRef.current;
            if (latestOutlineData) {
              const updatedOutline = updateItemContent(latestOutlineData.outline, item.id, generatedContent);
              updateOutline({
                ...latestOutlineData,
                outline: updatedOutline
              });
              
              // 最后一次更新，确保所有内容都显示
              debouncedUpdateEditor(generatedContent);
            }
          }
        } catch (err) {
          console.error('解析最后一块流式数据失败:', err);
        }
      }
      
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户主动取消，不显示错误
        console.log(`用户取消了章节 "${item.title}" 的生成`);
      } else {
        // 连接中断或其他错误
        console.error(`生成章节 "${item.title}" 内容失败:`, err);
        const errorMsg = err instanceof Error ? err.message : `生成章节 "${item.title}" 内容失败`;
        setError(errorMsg);
        
        // 如果有部分生成的内容，保存它
        if (savedGeneratedContent) {
          const latestOutlineData = outlineDataRef.current;
          if (latestOutlineData) {
            const updatedOutline = updateItemContent(latestOutlineData.outline, item.id, savedGeneratedContent);
            updateOutline({
              ...latestOutlineData,
              outline: updatedOutline
            });
          }
        }
      }
      return false;
    } finally {
      // 清理防抖定时器，确保不再有延迟更新
      if (updateTimeoutId) {
        clearTimeout(updateTimeoutId);
        // 立即执行最后一次更新，确保所有内容都已显示
        debouncedUpdateEditor(generatedContent);
      }
      
      // 结束流式更新，恢复同步
      setIsStreaming(false);
      
      // 从控制器引用中删除
      delete generationControllersRef.current[item.id];
      
      // 取消请求
      controller.abort();
      setIsGeneratingChapter(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };
  
  // 递归更新章节内容
  const updateItemContent = (items: OutlineItem[], itemId: string, content: string): OutlineItem[] => {
    return items.map(item => {
      // 如果章节被标记为不可见（已删除），则跳过
      if (item.visible === false) {
        return item;
      }
      
      if (item.id === itemId) {
        return {
          ...item,
          content: content
        };
      }
      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: updateItemContent(item.children, itemId, content)
        };
      }
      return item;
    });
  };
  
  // 取消章节内容生成
  const cancelChapterGeneration = (itemId: string) => {
    // 获取控制器并取消请求
    const controller = generationControllersRef.current[itemId];
    if (controller) {
      controller.abort();
      delete generationControllersRef.current[itemId];
      
      // 更新生成状态
      setIsGeneratingChapter(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      
      // 更新进度状态（如果是在批量生成中）
      setProgress(prev => {
        const newGenerating = new Set(prev.generating);
        newGenerating.delete(itemId);
        return {
          ...prev,
          generating: newGenerating
        };
      });
    }
  };
  
  // 生成所有内容
  const handleGenerateContent = async () => {
    if (isGenerating || !outlineDataRef.current?.outline) return;
    
    setIsGenerating(true);
    setProgress({
      total: 0,
      completed: 0,
      current: '',
      failed: [],
      generating: new Set<string>()
    });
    
    // 使用异步递归方式生成章节内容，避免UI阻塞
    const generatedItems = new Set<string>();
    
    const generateNextChapter = async () => {
      // 从最新的outlineData中重新收集leafItems
      let currentLeafItems: OutlineItem[] = [];
      if (outlineDataRef.current?.outline) {
        currentLeafItems = collectLeafItems(outlineDataRef.current.outline);
      }
      
      // 计算未生成的章节
      const ungeneratedItems = currentLeafItems.filter(item => !generatedItems.has(item.id));
      
      if (ungeneratedItems.length === 0) {
        // 所有章节都已生成
        setIsGenerating(false);
        
        // 生成完成后自动滚动到页面底部，确保所有章节都可见
        setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }, 500);
        
        return;
      }
      
      const currentItem = ungeneratedItems[0];
      
      // 更新进度信息
      setProgress(prev => ({
        ...prev,
        total: currentLeafItems.length,
        current: currentItem.title,
        generating: new Set(prev.generating).add(currentItem.id)
      }));
      
      try {
        // 调用章节内容生成函数（已支持流式输出）
        await generateChapterContent(currentItem);
        
        // 标记为已生成
        generatedItems.add(currentItem.id);
        
        // 更新进度：完成一个章节
        setProgress(prev => {
          const newGenerating = new Set(prev.generating);
          newGenerating.delete(currentItem.id);
          return {
            ...prev,
            completed: generatedItems.size,
            generating: newGenerating
          };
        });
      } catch (err) {
        console.error(`生成章节 "${currentItem?.title}" 失败:`, err);
        
        // 标记为已尝试生成（无论成功或失败）
        if (currentItem?.id) {
          generatedItems.add(currentItem.id);
        }
        
        // 更新进度：标记为失败
        setProgress(prev => {
          const newGenerating = new Set(prev.generating);
          newGenerating.delete(currentItem.id);
          return {
            ...prev,
            failed: [...prev.failed, currentItem.title],
            completed: generatedItems.size,
            generating: newGenerating
          };
        });
      }
      
      // 让浏览器有机会更新UI，然后继续生成下一个章节
      setTimeout(generateNextChapter, 0);
    };
    
    // 开始生成第一个章节
    generateNextChapter();
  };

  // 导出Word文档
  const handleExportWord = async () => {
    const currentOutlineData = outlineDataRef.current;
    if (!currentOutlineData?.outline) return;
    
    setIsExporting(true);
    setError(null);
    
    try {
      const response = await documentApi.exportWord({ 
        project_name: currentOutlineData.project_name || '投标技术文件',
        project_overview: currentOutlineData.project_overview || '',
        outline: currentOutlineData.outline || []
      });
      const blob = await response.blob();
      saveAs(blob, `${currentOutlineData.project_name || '投标技术文件'}.docx`);
    } catch (error) {
      console.error('导出Word文档失败:', error);
      setError('导出Word文档失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  // 回到顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // 更新章节要求
  const updateChapterRequirement = (chapterId: string, requirement: string) => {
    setChapterRequirements(prev => ({
      ...prev,
      [chapterId]: requirement
    }));
    
    // 更新outlineData中的prompt字段
    const latestOutlineData = outlineDataRef.current;
    if (!latestOutlineData?.outline) return;
    
    const updatedOutline = updateItemPrompt(latestOutlineData.outline, chapterId, requirement);
    updateOutline({
      ...latestOutlineData,
      outline: updatedOutline
    });
  };
  
  // 递归更新章节prompt
  const updateItemPrompt = (items: OutlineItem[], itemId: string, prompt: string): OutlineItem[] => {
    return items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          prompt
        };
      }
      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: updateItemPrompt(item.children, itemId, prompt)
        };
      }
      return item;
    });
  };
  
  // 删除章节
  const deleteChapter = async (chapterId: string) => {
    const currentOutlineData = outlineDataRef.current;
    if (!currentOutlineData?.outline) return;
    
    // 更新outlineData，移除指定章节
    const updatedOutline = updateItemVisibility(currentOutlineData.outline, chapterId, false);
    
    // 创建更新后的outlineData对象
    const newOutlineData = {
      ...currentOutlineData,
      outline: updatedOutline
    };
    
    // 更新状态
    updateOutline(newOutlineData);
    
    // 立即更新outlineDataRef，确保后续操作使用最新的outlineData
    outlineDataRef.current = newOutlineData;

    // 直接使用updatedOutline更新leafItems，确保侧边栏立即反映删除操作
    // 这样可以绕过父组件outlineData可能的异步更新延迟
    const updatedLeafItems = collectLeafItems(updatedOutline);
    setLeafItems(updatedLeafItems);

    // 从章节要求中移除
    setChapterRequirements(prev => {
      const newRequirements = {...prev};
      delete newRequirements[chapterId];
      return newRequirements;
    });
    
    // 如果当前正在编辑该章节，取消编辑
    if (editingChapterId === chapterId) {
      setEditingChapterId(null);
    }
    
    // 立即更新编辑器内容，移除已删除章节
    const editorInstance = getEditorInstance();
    if (editorInstance) {
      try {
        const { state } = editorInstance;
        const { doc } = state;
        
        // 查找要删除的章节的h1标题
        let chapterTitlePos = -1;
        let chapterTitleNode: any = null;
        
        // 先找到要删除的章节信息
        const deletedItem = findItemById(updatedOutline, chapterId);
        
        doc.descendants((node: any, pos: number) => {
          // 查找对应的章节标题
          if (!deletedItem) return true;
          
          if (node.type.name === 'heading' && node.attrs.level === 1 && node.textContent === deletedItem.title) {
            chapterTitlePos = pos;
            chapterTitleNode = node;
            return false; // 停止查找
          }
          return true;
        });
        
        if (chapterTitlePos !== -1 && chapterTitleNode) {
          // 找到标题后，查找章节的结束位置（下一个h1标题或文档结尾）
          let chapterEndPos = chapterTitlePos + chapterTitleNode.nodeSize;
          
          doc.descendants((node: any, pos: number) => {
            if (pos > chapterTitlePos && node.type.name === 'heading' && node.attrs.level === 1) {
              chapterEndPos = pos;
              return false; // 停止查找
            }
            return true;
          });
          
          // 如果没有找到下一个h1标题，章节结束位置就是文档结尾
          if (chapterEndPos <= chapterTitlePos + chapterTitleNode.nodeSize) {
            chapterEndPos = doc.content.size;
          }
          
          // 直接删除章节内容（包括标题和所有内容）
          await editorInstance
              .chain()
              .focus()
              .deleteRange({ from: chapterTitlePos, to: chapterEndPos })
              .run();
          
          console.log('局部删除章节成功');
        } else {
          // 找不到章节时，回退到原来的全量更新方式
          const editorFallback = getEditorInstance();
          if (editorFallback) {
            editorFallback.commands.setContent(generateFullContent(), { parseOptions: { preserveWhitespace: true } });
            console.log('找不到章节，使用全量更新');
          }
        }
      } catch (err) {
        console.error('局部删除失败，回退到全量更新:', err);
        // 出现错误时，回退到原来的全量更新方式
        const editorFallback = getEditorInstance();
        if (editorFallback) {
          editorFallback.commands.setContent(generateFullContent(), { parseOptions: { preserveWhitespace: true } });
        }
      }
    }
  };
  
  // 根据ID查找章节项目
  const findItemById = (items: OutlineItem[], itemId: string): OutlineItem | null => {
    for (const item of items) {
      if (item.id === itemId) {
        return item;
      }
      if (item.children && item.children.length > 0) {
        const found = findItemById(item.children, itemId);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  // 递归更新章节可见性（用于删除）
  const updateItemVisibility = (items: OutlineItem[], itemId: string, visible: boolean): OutlineItem[] => {
    return items.map(item => {
      if (item.id === itemId) {
        // 标记为指定的可见状态
        return {
          ...item,
          visible: visible
        };
      }
      if (item.children && item.children.length > 0) {
        // 递归更新子节点
        return {
          ...item,
          children: updateItemVisibility(item.children, itemId, visible)
        };
      }
      return item;
    });
  };

  // 渲染章节选择侧边栏
  const renderChapterSidebar = () => {
    return (
      <div className="w-64 bg-white rounded-lg shadow h-full overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">章节列表</h3>
        </div>
        <div className="p-4 space-y-3">
          {leafItems.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900">{item.title}</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingChapterId(editingChapterId === item.id ? null : item.id)}
                    className="inline-flex items-center px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95"
                    title={editingChapterId === item.id ? '收起要求' : '展开要求'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 mr-1 transition-transform duration-200 ${editingChapterId === item.id ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    要求
                  </button>
                  <button
                    onClick={() => generateChapterContent(item)}
                    disabled={isGeneratingChapter.has(item.id)}
                    className={`inline-flex items-center px-2 py-1 text-xs rounded-md ${isGeneratingChapter.has(item.id) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95`}
                  >
                    {isGeneratingChapter.has(item.id) ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-1 h-2.5 w-2.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        生成中...
                      </>
                    ) : '生成'}
                  </button>
                  
                  {/* 取消生成按钮 */}
                  {isGeneratingChapter.has(item.id) && (
                    <button
                      onClick={() => cancelChapterGeneration(item.id)}
                      className="inline-flex items-center px-2 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95"
                      title="取消生成"
                    >
                      <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      取消
                    </button>
                  )}
                  
                  <button
                    onClick={() => setConfirmDelete({ visible: true, chapterId: item.id, chapterTitle: item.title })}
                    className="inline-flex items-center px-2 py-1 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95"
                    title="删除章节"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    删除
                  </button>
                </div>
              </div>
              
              {editingChapterId === item.id && (
                <textarea
                  value={chapterRequirements[item.id] || item.prompt || ''}
                  onChange={(e) => updateChapterRequirement(item.id, e.target.value)}
                  placeholder="请输入章节要求..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染知识库侧边栏
  const renderKnowledgeBaseSidebar = () => {
    return (
      <div className="w-80 bg-white rounded-lg shadow h-full overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">知识库</h3>
        </div>
        <div className="p-4">
          {/* 知识库分组切换 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">选择知识库分组</h4>
            {isLoadingGroups ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-500">
                加载中...
              </div>
            ) : (
              <select
                value={selectedKnowledgeBaseGroup}
                onChange={(e) => setSelectedKnowledgeBaseGroup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {knowledgeBaseGroups.map((group) => (
                  <option key={group.name} value={group.name}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* 知识库搜索功能 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">搜索知识库</h4>
            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
              <input
                type="text"
                placeholder="搜索知识库内容..."
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
              />
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* 当前选中的知识库信息 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">当前知识库: {selectedKnowledgeBaseGroup || '未选择'}</h4>
            <p className="text-xs text-gray-500">
              {selectedKnowledgeBaseGroup ? 
                `您当前正在使用"${selectedKnowledgeBaseGroup}"知识库进行章节内容生成。` : 
                '请选择一个知识库分组以开始生成内容。'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // 工具栏组件
  const EditorToolbar = () => {
    if (!editor) return null;

    return (
      <div className="bg-white border-b border-gray-200 p-1 flex items-center gap-1 mb-6 shadow-sm overflow-x-auto">
        {/* 基本操作 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            className="p-2 rounded hover:bg-gray-100 transition-all duration-200"
            title="撤销"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            className="px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors"
            title="重做"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7l-7 7-7-7m14 0h-2.343M12 12.343l-1.657-1.657M12 12.343l1.657-1.657" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 标题选择器 */}
        <div className="flex items-center gap-0.5">
          <select
            value={editor.isActive('heading') ? `h${editor.getAttributes('heading').level}` : 'paragraph'}
            onChange={(e) => {
              if (e.target.value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
              } else {
                const level = parseInt(e.target.value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
                editor.chain().focus().toggleHeading({ level }).run();
              }
            }}
            className="p-1 border border-gray-300 rounded hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="paragraph">正文</option>
            <option value="h1">标题 1</option>
            <option value="h2">标题 2</option>
            <option value="h3">标题 3</option>
            <option value="h4">标题 4</option>
            <option value="h5">标题 5</option>
            <option value="h6">标题 6</option>
          </select>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 文本样式 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('bold') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="加粗"
          >
            <b>B</b>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('italic') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="斜体"
          >
            <i>I</i>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('strike') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="删除线"
          >
            <s>S</s>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('underline') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="下划线"
          >
            <u>U</u>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 列表 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('bulletList') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="无序列表"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('orderedList') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="有序列表"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 对齐方式 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.getAttributes('paragraph').textAlign === 'left' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="左对齐"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.getAttributes('paragraph').textAlign === 'center' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="居中对齐"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.getAttributes('paragraph').textAlign === 'right' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="右对齐"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.getAttributes('paragraph').textAlign === 'justify' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="两端对齐"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 引用和代码 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('blockquote') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="引用"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('codeBlock') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="代码块"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4m16 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('code') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="行内代码"
          >
            <code className="text-sm">code</code>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 链接和图片 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              const url = window.prompt('请输入链接地址:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className="p-2 rounded hover:bg-gray-100 transition-all duration-200 text-gray-700"
            title="插入链接"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          <button
            onClick={() => {
              const url = window.prompt('请输入图片地址:');
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            }}
            className="p-2 rounded hover:bg-gray-100 transition-all duration-200 text-gray-700"
            title="插入图片"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 分割线 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-2 rounded hover:bg-gray-100 transition-all duration-200 text-gray-700"
            title="插入分割线"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // 渲染确认删除模态框
  const renderConfirmDeleteModal = () => {
    const { visible, chapterId, chapterTitle } = confirmDelete;
    
    if (!visible || !chapterId) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">确认删除章节</h3>
          <p className="text-sm text-gray-600 mb-5">
            您确定要删除章节 "{chapterTitle}" 吗？此操作不可恢复，章节内容将被永久删除。
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setConfirmDelete({ ...confirmDelete, visible: false })}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
            >
              取消
            </button>
            <button
              onClick={() => {
                deleteChapter(chapterId);
                setConfirmDelete({ ...confirmDelete, visible: false });
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full mx-auto flex space-x-4 h-screen">
      {/* 左侧章节选择侧边栏 */}
      {renderChapterSidebar()}
      
      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">正文编辑</h2>
                <p className="text-sm text-gray-500 mt-1">
                  使用编辑器编辑完整的标书内容
                  {progress.failed.length > 0 && (
                    <span className="text-red-500 ml-2">失败 {progress.failed.length} 个</span>
                  )}
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleGenerateContent}
                  disabled={isGenerating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md active:scale-95"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      生成中...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-4 h-4 mr-2" />
                      生成标书
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleExportWord}
                  disabled={isExporting || !outlineData}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                  {isExporting ? '导出中...' : '导出Word'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* 编辑器区域 */}
        <div className="bg-white rounded-lg shadow flex-1 overflow-auto">
          <div className="p-6">
            {/* 编辑器工具栏 */}
            <EditorToolbar />
            
            {/* 进度条 */}
            {(isGenerating || isGeneratingChapter.size > 0) && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                {isGenerating ? (
                  <>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-blue-800 font-medium">正在生成标书</span>
                      <span className="text-blue-600">当前章节: {progress.current}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}></div>
                    </div>
                    <div className="text-xs text-blue-600">
                      已完成: {progress.completed} / {progress.total} 章节 {progress.failed.length > 0 ? `(失败 ${progress.failed.length} 个)` : ''}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-800 font-medium">正在生成章节</span>
                    <span className="text-blue-600">请稍候...</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Tiptap编辑器内容 */}
            <div className="prose max-w-none">
              <EditorContent editor={editor} className="outline-none" />
            </div>
            
            {/* 错误提示 */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
        
        {/* 回到顶部按钮 */}
        {showScrollToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      
      {/* 右侧知识库侧边栏 */}
      {renderKnowledgeBaseSidebar()}
      
      {/* 确认删除模态框 */}
      {renderConfirmDeleteModal()}
    </div>
  );
};

export default UnifiedEditPage;