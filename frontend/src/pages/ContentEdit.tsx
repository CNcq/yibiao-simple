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

  // 生成内容
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
    
    // 模拟生成过程
    for (const item of leafItems) {
      setProgress(prev => ({
        ...prev,
        current: item.title,
        generating: new Set(prev.generating).add(item.id)
      }));
      
      // 模拟生成延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProgress(prev => {
        const newGenerating = new Set(prev.generating);
        newGenerating.delete(item.id);
        return {
          ...prev,
          completed: prev.completed + 1,
          generating: newGenerating
        };
      });
    }
    
    setIsGenerating(false);
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
                <h4 className="text-lg font-medium text-gray-900 mb-2">{item.title}</h4>
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