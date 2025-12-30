/**
 * 统一编辑页面 - 整合正文编辑和全文编辑功能
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { EditorContent } from '@tiptap/react';

import { OutlineData, OutlineItem } from '../types';
import { useUnifiedEditor, generateFullContent, syncEditorContentToOutline, getEditorInstance } from './UnifiedEditPage/editor';
import { collectLeafItems, updateItemPrompt, findItemById, updateItemVisibility } from './UnifiedEditPage/outline';
import { WordStyleConfig, getDefaultWordStyleConfig } from './UnifiedEditPage/word-export';
import { useKnowledgeBaseGroups } from './UnifiedEditPage/knowledge-base';
import { generateChapterContent, cancelChapterGeneration, handleGenerateContent } from './UnifiedEditPage/chapter-generation';
import { useDebouncedUpdateEditor } from './UnifiedEditPage/editor-update';
import { renderChapterSidebar, renderKnowledgeBaseSidebar } from './UnifiedEditPage/sidebar';
import { EditorToolbar } from './UnifiedEditPage/editor-toolbar';
import { ConfirmDeleteModal } from './UnifiedEditPage/modal/confirm-delete';
import { PlayIcon, DocumentArrowDownIcon, ArrowUpIcon, ArrowLeftIcon, ArrowRightIcon, Bars3CenterLeftIcon } from '@heroicons/react/24/outline';
import { documentApi } from '../services/api';
import { saveAs } from 'file-saver';

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
  // 使用知识库分组hook
  const { 
    knowledgeBaseGroups, 
    selectedKnowledgeBaseGroup, 
    setSelectedKnowledgeBaseGroup, 
    isLoadingGroups 
  } = useKnowledgeBaseGroups();
  

  
  // 章节要求输入状态
  const [chapterRequirements, setChapterRequirements] = useState<Record<string, string>>({});
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  // 确认删除状态
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; chapterId: string | null; chapterTitle: string }>({ 
    visible: false, 
    chapterId: null, 
    chapterTitle: '' 
  });
  
  // Word导出配置状态
  const [wordConfigVisible, setWordConfigVisible] = useState(false);
  const [wordStyleConfig, setWordStyleConfig] = useState<WordStyleConfig>(getDefaultWordStyleConfig());

  
  // 使用ref跟踪outlineData和editor的最新值
  const outlineDataRef = useRef(outlineData);
  const editorRef = useRef<any>(null);
  
  // 用于取消生成的控制器引用
  const generationControllersRef = useRef<Record<string, AbortController>>({});
  
  // 安全获取编辑器实例的辅助函数 - 稍后定义
  
  // 初始化Tiptap编辑器
  const editor = useUnifiedEditor(generateFullContent(outlineData), true, (editor) => {
    // 流式更新期间禁用同步，避免冲突
    if (!isStreaming) {
      syncEditorContentToOutline(editor, outlineDataRef.current, updateOutline);
    }
  });

  // 更新叶子节点列表
  useEffect(() => {
    if (outlineData?.outline) {
      const leaves = collectLeafItems(outlineData.outline);
      setLeafItems(leaves);
    } else {
      setLeafItems([]);
    }
  }, [outlineData]);

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



  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  // 使用防抖更新编辑器内容的钩子
  const debouncedUpdateEditor = useDebouncedUpdateEditor(() => getEditorInstance(editor, editorRef));
  
  // 基于知识库为单个章节生成内容（支持流式输出）
  const generateChapterContentWrapper = useCallback(async (item: OutlineItem): Promise<boolean> => {
    return await generateChapterContent(
      item,
      outlineDataRef,
      updateOutline,
      selectedKnowledgeBaseGroup,
      chapterRequirements,
      setIsStreaming,
      setIsGeneratingChapter,
      setError,
      () => getEditorInstance(editor, editorRef),
      (content) => debouncedUpdateEditor(content, item)
    );
  }, [outlineDataRef, updateOutline, selectedKnowledgeBaseGroup, chapterRequirements, setIsStreaming, setIsGeneratingChapter, setError, debouncedUpdateEditor, editor, editorRef]);
  

  
  // 取消章节内容生成
  const cancelChapterGenerationWrapper = useCallback((itemId: string) => {
    cancelChapterGeneration(itemId, generationControllersRef, setIsGeneratingChapter, setProgress);
  }, [generationControllersRef, setIsGeneratingChapter, setProgress]);
  
  // 生成所有内容
  const handleGenerateContentWrapper = useCallback(() => {
    handleGenerateContent(
      isGenerating,
      outlineDataRef,
      updateOutline,
      collectLeafItems,
      setIsGenerating,
      setProgress,
      generateChapterContentWrapper
    );
  }, [isGenerating, outlineDataRef, updateOutline, setIsGenerating, setProgress, generateChapterContentWrapper]);

  // 导出Word文档
  // 点击导出Word时显示配置页面
  const handleExportWord = () => {
    setWordConfigVisible(true);
  };
  
  // 模态框中的实际导出函数
  const handleModalExport = async () => {
    const currentOutlineData = outlineDataRef.current;
    if (!currentOutlineData?.outline) return;
    
    setIsExporting(true);
    setError(null);
    
    try {
      const response = await documentApi.exportWord({ 
        project_name: currentOutlineData.project_name || '投标技术文件',
        project_overview: currentOutlineData.project_overview || '',
        outline: currentOutlineData.outline || [],
        styleConfig: wordStyleConfig // 传递用户选择的样式配置
      });
      const blob = await response.blob();
      saveAs(blob, `${currentOutlineData.project_name || '投标技术文件'}.docx`);
      setWordConfigVisible(false); // 导出完成后关闭配置页面
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
    const editorInstance = getEditorInstance(editor, editorRef);
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
          const editorFallback = getEditorInstance(editor, editorRef);
          if (editorFallback) {
            editorFallback.commands.setContent(generateFullContent(currentOutlineData), { parseOptions: { preserveWhitespace: true } });
            console.log('找不到章节，使用全量更新');
          }
        }
      } catch (err) {
        console.error('局部删除失败，回退到全量更新:', err);
        // 出现错误时，回退到原来的全量更新方式
        const editorFallback = getEditorInstance(editor, editorRef);
        if (editorFallback) {
          editorFallback.commands.setContent(generateFullContent(currentOutlineData), { parseOptions: { preserveWhitespace: true } });
        }
      }
    }
  };
  




  // 渲染章节选择侧边栏






  // 渲染Word配置模态框
  const renderWordConfigModal = () => {
    if (!wordConfigVisible) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 my-8 flex flex-col md:flex-row max-h-[80vh] overflow-hidden">
          {/* 左侧预览区域 */}
          <div className="w-full md:w-1/2 p-6 border-r border-gray-200 overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">预览</h3>
            <div className="bg-white p-6 border border-gray-200 rounded-lg">
              <h1 
                className="mb-4" 
                style={{
                  fontSize: wordStyleConfig.level1?.size === '二号' ? '20px' : 
                           wordStyleConfig.level1?.size === '三号' ? '16px' : 
                           wordStyleConfig.level1?.size === '四号' ? '14px' : 
                           wordStyleConfig.level1?.size === '小四号' ? '12px' : '18px',
                  fontWeight: wordStyleConfig.level1?.bold ? 'bold' : 'normal',
                  fontStyle: wordStyleConfig.level1?.italic ? 'italic' : 'normal',
                  textDecoration: wordStyleConfig.level1?.underline ? 'underline' : 'none',
                  textAlign: (wordStyleConfig.level1?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
                }}
              >
                {wordStyleConfig.chapterStart.replace('第', '').replace('章', '')}章 项目总体概述及运维方案
              </h1>
              <h2 
                className="mb-3"
                style={{
                  fontSize: wordStyleConfig.level2?.size === '二号' ? '20px' : 
                           wordStyleConfig.level2?.size === '三号' ? '16px' : 
                           wordStyleConfig.level2?.size === '四号' ? '14px' : 
                           wordStyleConfig.level2?.size === '小四号' ? '12px' : '18px',
                  fontWeight: wordStyleConfig.level2?.bold ? 'bold' : 'normal',
                  fontStyle: wordStyleConfig.level2?.italic ? 'italic' : 'normal',
                  textDecoration: wordStyleConfig.level2?.underline ? 'underline' : 'none',
                  textAlign: (wordStyleConfig.level2?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
                }}
              >
                第{wordStyleConfig.chapterStart.replace('第', '').replace('章', '')}节 项目背景
              </h2>
              <h3 
                className="mb-2"
                style={{
                  fontSize: wordStyleConfig.level3?.size === '二号' ? '20px' : 
                           wordStyleConfig.level3?.size === '三号' ? '16px' : 
                           wordStyleConfig.level3?.size === '四号' ? '14px' : 
                           wordStyleConfig.level3?.size === '小四号' ? '12px' : '18px',
                  fontWeight: wordStyleConfig.level3?.bold ? 'bold' : 'normal',
                  fontStyle: wordStyleConfig.level3?.italic ? 'italic' : 'normal',
                  textDecoration: wordStyleConfig.level3?.underline ? 'underline' : 'none',
                  textAlign: (wordStyleConfig.level3?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
                }}
              >
                一、项目背景
              </h3>
              <p 
                className="mb-4"
                style={{
                  fontSize: wordStyleConfig.body?.size === '二号' ? '20px' : 
                           wordStyleConfig.body?.size === '三号' ? '16px' : 
                           wordStyleConfig.body?.size === '四号' ? '14px' : 
                           wordStyleConfig.body?.size === '小四号' ? '12px' : '10px',
                  fontWeight: wordStyleConfig.body?.bold ? 'bold' : 'normal',
                  fontStyle: wordStyleConfig.body?.italic ? 'italic' : 'normal',
                  textDecoration: wordStyleConfig.body?.underline ? 'underline' : 'none',
                  textAlign: (wordStyleConfig.body?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
                }}
              >
                某某省某某市位于长江三角洲地区，是全国重要的经济中心和制造业基地。
                近年来，随着城市化进程的加速和工业化水平的提升，大气污染问题日益突出，
                给人民群众的生活带来了严重的影响。
              </p>
              <p 
                className="mb-4"
                style={{
                  fontSize: wordStyleConfig.body?.size === '三号' ? '16px' : 
                           wordStyleConfig.body?.size === '四号' ? '14px' : 
                           wordStyleConfig.body?.size === '小四号' ? '12px' : '10px',
                  fontWeight: wordStyleConfig.body?.bold ? 'bold' : 'normal',
                  fontStyle: wordStyleConfig.body?.italic ? 'italic' : 'normal',
                  textDecoration: wordStyleConfig.body?.underline ? 'underline' : 'none',
                  textAlign: (wordStyleConfig.body?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
                }}
              >
                为了改善空气质量，保障人民群众的身体健康，市政府决定实施大气污染防治
                专项行动，建设一套先进的大气环境监测系统，实时监控空气质量状况，
                为环境管理和决策提供科学依据。
              </p>
              <h3 
                className="mb-2"
                style={{
                  fontSize: wordStyleConfig.level3?.size === '三号' ? '16px' : 
                           wordStyleConfig.level3?.size === '四号' ? '14px' : 
                           wordStyleConfig.level3?.size === '小四号' ? '12px' : '18px',
                  fontWeight: wordStyleConfig.level3?.bold ? 'bold' : 'normal',
                  fontStyle: wordStyleConfig.level3?.italic ? 'italic' : 'normal',
                  textDecoration: wordStyleConfig.level3?.underline ? 'underline' : 'none',
                  textAlign: (wordStyleConfig.level3?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
                }}
              >
                二、项目目标
              </h3>
              <ol 
                className="pl-5 mb-4"
                type={wordStyleConfig.orderedList?.level1 === '1/2/3' ? '1' : 
                      wordStyleConfig.orderedList?.level1 === '(1)/(2)/(3)' ? '1' : 'a'}
              >
                <li>建立覆盖全市的大气环境监测网络</li>
                <li>实现空气质量数据的实时采集、传输和存储</li>
                <li>建立空气质量预警预报系统</li>
                <li>为环境管理和决策提供科学依据</li>
              </ol>
              <ul 
                className="pl-5"
                style={{
                  listStyleType: wordStyleConfig.unorderedList?.level1 === '•/•/•' ? 'disc' : 
                                 wordStyleConfig.unorderedList?.level1 === '○/○/○' ? 'circle' : 
                                 wordStyleConfig.unorderedList?.level1 === '□/□/□' ? 'square' : 'disc'
                }}
              >
                <li>系统稳定性要求高</li>
                <li>数据传输实时性强</li>
                <li>系统可扩展性好</li>
                <li>操作维护简便</li>
              </ul>
            </div>
          </div>
          
          {/* 右侧配置区域 */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">选择标书格式</h3>
              <button
                onClick={() => setWordConfigVisible(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 标书下载风格 */}
            <div className="mb-6">
              <h4 className="text-base font-medium text-gray-900 mb-3">标书下载风格</h4>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setWordStyleConfig({
                    styleName: '经典正式',
                    titleFormat: '第一章/第一节',
                    chapterStart: '第一章',
                    level1: { font: '黑体', size: '二号', bold: true, italic: false, underline: false, align: 'center', firstLineIndent: false },
                    level2: { font: '黑体', size: '三号', bold: true, italic: false, underline: false, align: 'center', firstLineIndent: false },
                    level3: { font: '黑体', size: '四号', bold: true, italic: false, underline: false, align: 'left', firstLineIndent: false },
                    body: { font: '宋体', size: '小四号', bold: false, italic: false, underline: false, align: 'left', firstLineIndent: false },
                    orderedList: { level1: '一/二/三', level2: '(一)/(二)/(三)', level3: '1/2/3' },
                    unorderedList: { level1: '•/•/•', level2: '○/○/○', level3: '□/□/□' }
                  })}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${wordStyleConfig.styleName === '经典正式' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  经典正式
                </button>
                <button
                  onClick={() => setWordStyleConfig({
                    styleName: '简洁商务',
                    titleFormat: '第1章/1.1',
                    chapterStart: '第1章',
                    level1: { font: '微软雅黑', size: '二号', bold: true, italic: false, underline: false, align: 'left', firstLineIndent: false },
                    level2: { font: '微软雅黑', size: '三号', bold: true, italic: false, underline: false, align: 'left', firstLineIndent: false },
                    level3: { font: '微软雅黑', size: '四号', bold: true, italic: false, underline: false, align: 'left', firstLineIndent: false },
                    body: { font: '微软雅黑', size: '四号', bold: false, italic: false, underline: false, align: 'left', firstLineIndent: false },
                    orderedList: { level1: '1/2/3', level2: '1.1/1.2/1.3', level3: '1.1.1/1.1.2/1.1.3' },
                    unorderedList: { level1: '•/•/•', level2: '•/•/•', level3: '•/•/•' }
                  })}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${wordStyleConfig.styleName === '简洁商务' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  简洁商务
                </button>
                <button
                  onClick={() => setWordStyleConfig({
                    styleName: '专业学术',
                    titleFormat: '1./1.1',
                    chapterStart: '第1章',
                    level1: { font: '宋体', size: '二号', bold: true, italic: false, underline: false, align: 'center', firstLineIndent: false },
                    level2: { font: '宋体', size: '三号', bold: true, italic: false, underline: false, align: 'left', firstLineIndent: false },
                    level3: { font: '宋体', size: '四号', bold: true, italic: false, underline: false, align: 'left', firstLineIndent: false },
                    body: { font: '宋体', size: '小四号', bold: false, italic: false, underline: false, align: 'justify', firstLineIndent: false },
                    orderedList: { level1: '1/2/3', level2: '1.1/1.2/1.3', level3: '1.1.1/1.1.2/1.1.3' },
                    unorderedList: { level1: '-/-/-', level2: '--/--/--', level3: '---/---/---' }
                  })}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${wordStyleConfig.styleName === '专业学术' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  专业学术
                </button>
                <button
                  onClick={() => setWordStyleConfig(prev => ({ ...prev, styleName: '自定义' }))}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${wordStyleConfig.styleName === '自定义' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  自定义
                </button>
              </div>
            </div>
            
            {/* 标题格式 */}
            <div className="mb-6 border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-base font-medium text-gray-900">标题格式</h4>
                <button className="text-blue-600 hover:text-blue-800 text-sm">编辑当前格式</button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">风格名称</label>
                  <input
                    type="text"
                    value={wordStyleConfig.styleName}
                    onChange={(e) => setWordStyleConfig(prev => ({ ...prev, styleName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">章节起点</label>
                  <select
                    value={wordStyleConfig.chapterStart}
                    onChange={(e) => setWordStyleConfig(prev => ({ ...prev, chapterStart: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="第一章">第一章</option>
                    <option value="第1章">第1章</option>
                    <option value="一、">一、</option>
                    <option value="1.">1.</option>
                  </select>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">标题样式</label>
                <select
                  value={wordStyleConfig.titleFormat}
                  onChange={(e) => setWordStyleConfig(prev => ({ ...prev, titleFormat: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="第一章/第一节">第一章/第一节</option>
                  <option value="第1章/1.1">第1章/1.1</option>
                  <option value="一、(一)">一、(一)</option>
                  <option value="1./1.1">1./1.1</option>
                </select>
              </div>
            </div>
            
            {/* 各级标题设置 */}
            <div className="mb-6">
              <h4 className="text-base font-medium text-gray-900 mb-3">标题格式设置</h4>
              
              {/* 一级标题 */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-800 mb-2">一级标题</h5>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">字体：</label>
                    <select
                      value={wordStyleConfig.level1.font}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, level1: { ...prev.level1, font: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="宋体">宋体</option>
                      <option value="黑体">黑体</option>
                      <option value="楷体">楷体</option>
                      <option value="微软雅黑">微软雅黑</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">字号：</label>
                    <select
                      value={wordStyleConfig.level1.size}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, level1: { ...prev.level1, size: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="二号">二号</option>
                      <option value="三号">三号</option>
                      <option value="四号">四号</option>
                      <option value="小四号">小四号</option>
                    </select>
                  </div>
                  {/* 对齐方式 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setWordStyleConfig(prev => ({ ...prev, level1: { ...prev.level1, align: 'left' } }))}
                      className={`p-2 rounded-md ${wordStyleConfig.level1.align === 'left' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      aria-label="左对齐"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setWordStyleConfig(prev => ({ ...prev, level1: { ...prev.level1, align: 'center' } }))}
                      className={`p-2 rounded-md ${wordStyleConfig.level1.align === 'center' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      aria-label="居中对齐"
                    >
                      <Bars3CenterLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setWordStyleConfig(prev => ({ ...prev, level1: { ...prev.level1, align: 'right' } }))}
                      className={`p-2 rounded-md ${wordStyleConfig.level1.align === 'right' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      aria-label="右对齐"
                    >
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {/* 首行缩进 */}
                  <button
                    onClick={() => setWordStyleConfig(prev => ({ ...prev, level1: { ...prev.level1, firstLineIndent: !prev.level1.firstLineIndent } }))}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${wordStyleConfig.level1.firstLineIndent ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    首行缩进
                  </button>
                </div>
              </div>
              
              {/* 二级标题 */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-800 mb-2">二级标题</h5>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">字体：</label>
                    <select
                      value={wordStyleConfig.level2.font}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, level2: { ...prev.level2, font: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="宋体">宋体</option>
                      <option value="黑体">黑体</option>
                      <option value="楷体">楷体</option>
                      <option value="微软雅黑">微软雅黑</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">字号：</label>
                    <select
                      value={wordStyleConfig.level2.size}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, level2: { ...prev.level2, size: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="二号">二号</option>
                      <option value="三号">三号</option>
                      <option value="四号">四号</option>
                      <option value="小四号">小四号</option>
                    </select>
                  </div>
                  {/* 对齐方式 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setWordStyleConfig(prev => ({ ...prev, level2: { ...prev.level2, align: 'left' } }))}
                      className={`p-2 rounded-md ${wordStyleConfig.level2.align === 'left' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      aria-label="左对齐"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setWordStyleConfig(prev => ({ ...prev, level2: { ...prev.level2, align: 'center' } }))}
                      className={`p-2 rounded-md ${wordStyleConfig.level2.align === 'center' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      aria-label="居中对齐"
                    >
                      <Bars3CenterLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setWordStyleConfig(prev => ({ ...prev, level2: { ...prev.level2, align: 'right' } }))}
                      className={`p-2 rounded-md ${wordStyleConfig.level2.align === 'right' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      aria-label="右对齐"
                    >
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {/* 首行缩进 */}
                  <button
                    onClick={() => setWordStyleConfig(prev => ({ ...prev, level2: { ...prev.level2, firstLineIndent: !prev.level2.firstLineIndent } }))}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${wordStyleConfig.level2.firstLineIndent ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    首行缩进
                  </button>
                </div>
              </div>
              
              {/* 三级标题 */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-800 mb-2">三级标题</h5>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">字体：</label>
                    <select
                      value={wordStyleConfig.level3.font}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, level3: { ...prev.level3, font: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="宋体">宋体</option>
                      <option value="黑体">黑体</option>
                      <option value="楷体">楷体</option>
                      <option value="微软雅黑">微软雅黑</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">字号：</label>
                    <select
                      value={wordStyleConfig.level3.size}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, level3: { ...prev.level3, size: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="二号">二号</option>
                      <option value="三号">三号</option>
                      <option value="四号">四号</option>
                      <option value="小四号">小四号</option>
                    </select>
                  </div>
                  {/* 对齐方式 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setWordStyleConfig(prev => ({ ...prev, level3: { ...prev.level3, align: 'left' } }))}
                      className={`p-2 rounded-md ${wordStyleConfig.level3.align === 'left' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      aria-label="左对齐"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setWordStyleConfig(prev => ({ ...prev, level3: { ...prev.level3, align: 'center' } }))}
                      className={`p-2 rounded-md ${wordStyleConfig.level3.align === 'center' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      aria-label="居中对齐"
                    >
                      <Bars3CenterLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setWordStyleConfig(prev => ({ ...prev, level3: { ...prev.level3, align: 'right' } }))}
                      className={`p-2 rounded-md ${wordStyleConfig.level3.align === 'right' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      aria-label="右对齐"
                    >
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {/* 首行缩进 */}
                  <button
                    onClick={() => setWordStyleConfig(prev => ({ ...prev, level3: { ...prev.level3, firstLineIndent: !prev.level3.firstLineIndent } }))}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${wordStyleConfig.level3.firstLineIndent ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    首行缩进
                  </button>
                </div>
              </div>
            </div>
            
            {/* 正文设置 */}
            <div className="mb-6">
              <h4 className="text-base font-medium text-gray-900 mb-3">正文</h4>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center">
                  <label className="block text-sm font-medium text-gray-700 mr-2">字体：</label>
                  <select
                    value={wordStyleConfig.body.font}
                    onChange={(e) => setWordStyleConfig(prev => ({ ...prev, body: { ...prev.body, font: e.target.value } }))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="宋体">宋体</option>
                    <option value="黑体">黑体</option>
                    <option value="楷体">楷体</option>
                    <option value="微软雅黑">微软雅黑</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="block text-sm font-medium text-gray-700 mr-2">字号：</label>
                  <select
                    value={wordStyleConfig.body.size}
                    onChange={(e) => setWordStyleConfig(prev => ({ ...prev, body: { ...prev.body, size: e.target.value } }))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="三号">三号</option>
                    <option value="四号">四号</option>
                    <option value="小四号">小四号</option>
                    <option value="五号">五号</option>
                  </select>
                </div>
                {/* 对齐方式 */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setWordStyleConfig(prev => ({ ...prev, body: { ...prev.body, align: 'left' } }))}
                    className={`p-2 rounded-md ${wordStyleConfig.body.align === 'left' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    aria-label="左对齐"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setWordStyleConfig(prev => ({ ...prev, body: { ...prev.body, align: 'center' } }))}
                    className={`p-2 rounded-md ${wordStyleConfig.body.align === 'center' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    aria-label="居中对齐"
                  >
                    <Bars3CenterLeftIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setWordStyleConfig(prev => ({ ...prev, body: { ...prev.body, align: 'right' } }))}
                    className={`p-2 rounded-md ${wordStyleConfig.body.align === 'right' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    aria-label="右对齐"
                  >
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
                
                {/* 首行缩进 */}
                <button
                  onClick={() => setWordStyleConfig(prev => ({ ...prev, body: { ...prev.body, firstLineIndent: !prev.body.firstLineIndent } }))}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${wordStyleConfig.body.firstLineIndent ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  首行缩进
                </button>
              </div>
            </div>
            
            {/* 列表设置 */}
            <div className="mb-6">
              <h4 className="text-base font-medium text-gray-900 mb-3">列表格式</h4>
              
              {/* 有序列表 */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-800 mb-2">有序列表</h5>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">一级：</label>
                    <select
                      value={wordStyleConfig.orderedList.level1}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, orderedList: { ...prev.orderedList, level1: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1/2/3">1/2/3</option>
                      <option value="(1)/(2)/(3)">(1)/(2)/(3)</option>
                      <option value="一/二/三">一/二/三</option>
                      <option value="(一)/(二)/(三)">(一)/(二)/(三)</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">二级：</label>
                    <select
                      value={wordStyleConfig.orderedList.level2}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, orderedList: { ...prev.orderedList, level2: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1/2/3">1/2/3</option>
                      <option value="(1)/(2)/(3)">(1)/(2)/(3)</option>
                      <option value="一/二/三">一/二/三</option>
                      <option value="(一)/(二)/(三)">(一)/(二)/(三)</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">三级：</label>
                    <select
                      value={wordStyleConfig.orderedList.level3}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, orderedList: { ...prev.orderedList, level3: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1/2/3">1/2/3</option>
                      <option value="(1)/(2)/(3)">(1)/(2)/(3)</option>
                      <option value="一/二/三">一/二/三</option>
                      <option value="(一)/(二)/(三)">(一)/(二)/(三)</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* 无序列表 */}
              <div>
                <h5 className="text-sm font-medium text-gray-800 mb-2">无序列表</h5>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">一级：</label>
                    <select
                      value={wordStyleConfig.unorderedList.level1}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, unorderedList: { ...prev.unorderedList, level1: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="•/•/•">•/•/•</option>
                      <option value="○/○/○">○/○/○</option>
                      <option value="□/□/□">□/□/□</option>
                      <option value="-/--/---">-/--/---</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">二级：</label>
                    <select
                      value={wordStyleConfig.unorderedList.level2}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, unorderedList: { ...prev.unorderedList, level2: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="•/•/•">•/•/•</option>
                      <option value="○/○/○">○/○/○</option>
                      <option value="□/□/□">□/□/□</option>
                      <option value="-/--/---">-/--/---</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mr-2">三级：</label>
                    <select
                      value={wordStyleConfig.unorderedList.level3}
                      onChange={(e) => setWordStyleConfig(prev => ({ ...prev, unorderedList: { ...prev.unorderedList, level3: e.target.value } }))}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="•/•/•">•/•/•</option>
                      <option value="○/○/○">○/○/○</option>
                      <option value="□/□/□">□/□/□</option>
                      <option value="-/--/---">-/--/---</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 下载按钮 */}
            <div className="flex justify-end">
              <button
                onClick={handleModalExport}
                disabled={isExporting}
                className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? '导出中...' : '下载标书'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full mx-auto flex space-x-4 h-screen">
      {/* 左侧章节选择侧边栏 */}
      {renderChapterSidebar({
        leafItems,
        editingChapterId,
        isGeneratingChapter,
        chapterRequirements,
        onSetEditingChapterId: setEditingChapterId,
        onUpdateChapterRequirement: updateChapterRequirement,
        onGenerateChapterContent: generateChapterContentWrapper,
        onCancelChapterGeneration: cancelChapterGenerationWrapper,
        onSetConfirmDelete: setConfirmDelete
      })}
      
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
                  onClick={handleGenerateContentWrapper}
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
            <EditorToolbar editor={editor} />
            
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
      {renderKnowledgeBaseSidebar({
        knowledgeBaseGroups,
        selectedKnowledgeBaseGroup,
        isLoadingGroups,
        onSetSelectedKnowledgeBaseGroup: setSelectedKnowledgeBaseGroup
      })}
      
      {/* 确认删除模态框 */}
      <ConfirmDeleteModal
        visible={confirmDelete.visible}
        chapterId={confirmDelete.chapterId}
        chapterTitle={confirmDelete.chapterTitle}
        onCancel={() => setConfirmDelete({ ...confirmDelete, visible: false })}
        onConfirm={deleteChapter}
      />
      
      {/* Word配置模态框 */}
      {renderWordConfigModal()}
    </div>
  );
};

export default UnifiedEditPage;