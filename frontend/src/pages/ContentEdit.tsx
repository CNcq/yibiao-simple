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
import { contentApi, ChapterContentRequest, documentApi, knowledgeBaseApi } from '../services/api';
import { saveAs } from 'file-saver';

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
    generating: new Set<string>() // 正在生成的项目ID集合
  });
  const [leafItems, setLeafItems] = useState<OutlineItem[]>([]);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [isGeneratingChapter, setIsGeneratingChapter] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  // 使用ref跟踪outlineData的最新值
  const outlineDataRef = React.useRef(outlineData);
  
  useEffect(() => {
    outlineDataRef.current = outlineData;
  }, [outlineData]);
  
  // 知识库相关状态
  const [knowledgeBaseOpen, setKnowledgeBaseOpen] = useState(true);
  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [kbSearchResults, setKbSearchResults] = useState<any[]>([]);
  const [kbStats, setKbStats] = useState({ document_count: 0 });
  const [kbNewDocTitle, setKbNewDocTitle] = useState('');
  const [kbNewDocContent, setKbNewDocContent] = useState('');
  const [isKbLoading, setIsKbLoading] = useState(false);
  const [isKbSaving, setIsKbSaving] = useState(false);

  // 获取知识库统计信息
  useEffect(() => {
    const fetchKbStats = async () => {
      try {
        const response = await knowledgeBaseApi.getKnowledgeBaseStats();
        setKbStats(response.data.stats);
      } catch (error) {
        console.error('获取知识库统计失败:', error);
      }
    };
    fetchKbStats();
  }, []);

  // 搜索知识库
  const handleKbSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbSearchQuery.trim()) return;
    
    setIsKbLoading(true);
    try {
      const response = await knowledgeBaseApi.searchKnowledgeBase(kbSearchQuery);
      setKbSearchResults(response.data.results);
    } catch (error) {
      console.error('搜索知识库失败:', error);
    } finally {
      setIsKbLoading(false);
    }
  };

  // 添加文档到知识库
  const handleKbAddDocument = async () => {
    if (!kbNewDocTitle.trim() || !kbNewDocContent.trim()) return;
    
    setIsKbSaving(true);
    try {
      await knowledgeBaseApi.addDocuments([{
        title: kbNewDocTitle,
        content: kbNewDocContent
      }]);
      
      // 清空表单
      setKbNewDocTitle('');
      setKbNewDocContent('');
      
      // 更新知识库统计
      const response = await knowledgeBaseApi.getKnowledgeBaseStats();
      setKbStats(response.data.stats);
    } catch (error) {
      console.error('添加文档到知识库失败:', error);
    } finally {
      setIsKbSaving(false);
    }
  };

  // 清空知识库
  const handleKbClear = async () => {
    if (!window.confirm('确定要清空知识库吗？此操作不可恢复。')) return;
    
    try {
      await knowledgeBaseApi.clearKnowledgeBase();
      setKbStats({ document_count: 0 });
      setKbSearchResults([]);
    } catch (error) {
      console.error('清空知识库失败:', error);
    }
  };

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

  // 更新叶子节点列表
  useEffect(() => {
    if (outlineData?.outline) {
      const leaves = collectLeafItems(outlineData.outline);
      setLeafItems(leaves);
    } else {
      setLeafItems([]);
    }
  }, [outlineData, collectLeafItems]);

  // 基于知识库为单个章节生成内容
  const generateChapterContent = async (item: OutlineItem): Promise<boolean> => {
    const currentOutlineData = outlineDataRef.current;
    if (!currentOutlineData) return false;
    
    setIsGeneratingChapter(prev => new Set(prev).add(item.id));
    setError(null);
    
    try {
      // 1. 基于章节名称搜索知识库
      const kbResults = await knowledgeBaseApi.searchKnowledgeBase(item.title, 10);
      const knowledgeBaseReferences = kbResults.data.results || [];
      
      // 2. 准备内容生成请求
      const request: ChapterContentRequest = {
        chapter: item,
        project_overview: currentOutlineData.project_overview || '',
        prompt: knowledgeBaseReferences.length > 0 
          ? `请基于以下参考资料，结合项目概述，生成"${item.title}"章节的详细内容：

参考资料：
${knowledgeBaseReferences.map((ref: any, index: number) => `${index + 1}. ${ref.summary}`).join('\n\n')}`
          : undefined
      };
      
      // 3. 调用内容生成API
      const response = await contentApi.generateChapterContent(request);
      
      // 4. 获取最新的outlineData，确保更新基于最新状态
      const latestOutlineData = outlineDataRef.current;
      if (!latestOutlineData) return false;
      
      // 5. 更新章节内容
      const updatedOutline = updateItemContent(latestOutlineData.outline, item.id, response.data.content);
      
      // 6. 更新状态
      updateOutline({
        ...latestOutlineData,
        outline: updatedOutline
      });
      
      return true;
    } catch (err) {
      console.error(`生成章节 "${item.title}" 内容失败:`, err);
      setError(`生成章节 "${item.title}" 内容失败`);
      return false;
    } finally {
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
  
  // 生成所有内容
  const handleGenerateContent = async () => {
    if (isGenerating || leafItems.length === 0) return;
    
    setIsGenerating(true);
    setProgress({
      total: leafItems.length,
      completed: 0,
      current: '',
      failed: [],
      generating: new Set<string>()
    });
    
    // 实际生成所有章节内容
    let generatedItems = new Set<string>();
    let currentLeafItems: OutlineItem[] = [];
    
    while (true) {
      // 每次迭代都从最新的outlineData中重新收集leafItems
      if (outlineDataRef.current?.outline) {
        currentLeafItems = collectLeafItems(outlineDataRef.current.outline);
      }
      
      // 计算未生成的章节
      const ungeneratedItems = currentLeafItems.filter(item => !generatedItems.has(item.id));
      
      if (ungeneratedItems.length === 0) {
        break; // 所有章节都已生成
      }
      
      // 创建副本避免no-loop-func警告
      const currentLeafItemsCopy = currentLeafItems;
      const firstUngeneratedItem = ungeneratedItems[0];
      
      // 更新进度信息
      setProgress(prev => ({
        ...prev,
        total: currentLeafItemsCopy.length,
        current: firstUngeneratedItem.title,
        generating: new Set(prev.generating).add(firstUngeneratedItem.id)
      }));
      
      // 声明item变量在循环外部，避免no-loop-func警告
      const currentItem = ungeneratedItems[0];
      
      try {
        // 调用章节内容生成函数
        await generateChapterContent(currentItem);
        
        // 等待更长时间，确保outlineData更新完成
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
        console.error(`生成章节 "${currentItem.title}" 失败:`, err);
        
        // 标记为已尝试生成（无论成功或失败）
        generatedItems.add(currentItem.id);
        
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
    }
    
    // 等待更长时间，确保outlineData完全更新
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 使用最新的outlineData更新leafItems
    if (outlineDataRef.current?.outline) {
      const leaves = collectLeafItems(outlineDataRef.current.outline);
      setLeafItems(leaves);
    }
    
    setIsGenerating(false);
    
    // 生成完成后自动滚动到页面底部，确保所有章节都可见
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 500);
  };

  // 导出Word文档
  const handleExportWord = async () => {
    if (!outlineData) return;
    
    try {
      const response = await documentApi.exportWord({ 
        project_name: outlineData.project_name || '投标技术文件',
        project_overview: outlineData.project_overview || '',
        outline: outlineData.outline || []
      });
      const blob = await response.blob();
      saveAs(blob, `${outlineData.project_name || '投标技术文件'}.docx`);
    } catch (error) {
      console.error('导出Word文档失败:', error);
    }
  };

  // 回到顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 渲染知识库侧边栏
  const renderKnowledgeBaseSidebar = () => {
    return (
      <div className={`w-80 bg-white rounded-lg shadow ${knowledgeBaseOpen ? 'block' : 'hidden'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">默认知识库</h3>
            <button
              onClick={() => setKnowledgeBaseOpen(!knowledgeBaseOpen)}
              className="text-gray-500 hover:text-gray-700"
            >
              <span className="sr-only">关闭</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 知识库统计 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600">文档数量: {kbStats.document_count}</p>
          </div>

          {/* 添加文档 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">添加新文档</h4>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="文档标题"
                value={kbNewDocTitle}
                onChange={(e) => setKbNewDocTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="文档内容"
                value={kbNewDocContent}
                onChange={(e) => setKbNewDocContent(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleKbAddDocument}
                disabled={isKbSaving || !kbNewDocTitle.trim() || !kbNewDocContent.trim()}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isKbSaving ? '添加中...' : '插入知识库材料'}
              </button>
            </div>
          </div>

          {/* 搜索知识库 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">搜索知识库</h4>
            <form onSubmit={handleKbSearch} className="space-y-2">
              <input
                type="text"
                placeholder="搜索知识库"
                value={kbSearchQuery}
                onChange={(e) => setKbSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isKbLoading || !kbSearchQuery.trim()}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isKbLoading ? '搜索中...' : '搜索'}
              </button>
            </form>
          </div>

          {/* 清空知识库 */}
          <button
            onClick={handleKbClear}
            disabled={kbStats.document_count === 0}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            清空知识库
          </button>
        </div>
      </div>
    );
  };

  // 计算已完成的项目数量
  const completedItems = leafItems.filter(item => item.content).length;

  return (
    <div className="w-full max-w-full mx-auto flex space-x-4">
      {/* 主内容区域 */}
      <div className="flex-1">
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
          </div>
        </div>
        
        {/* 内容区域 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">标书内容预览</h3>
          <div className="space-y-6">
            {leafItems.map((item) => (
              <div key={item.id} className="border-b border-gray-200 pb-6">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-lg font-medium text-gray-900">{item.title}</h4>
                  <button
                    onClick={() => generateChapterContent(item)}
                    disabled={isGeneratingChapter.has(item.id)}
                    className={`inline-flex items-center px-3 py-1 text-sm rounded-md ${isGeneratingChapter.has(item.id) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                  >
                    {isGeneratingChapter.has(item.id) ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        生成中...
                      </>
                    ) : (
                      <>
                        <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"></path>
                        </svg>
                        基于知识库生成
                      </>
                    )}
                  </button>
                </div>
                <div className="prose max-w-none">
                  {item.content || <p className="text-gray-400 italic">内容尚未生成</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 右侧统计信息 */}
      <div className="w-80">
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">项目统计</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
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
      
      {/* 知识库侧边栏 */}
      {renderKnowledgeBaseSidebar()}
    </div>
  );
}

export default ContentEdit;