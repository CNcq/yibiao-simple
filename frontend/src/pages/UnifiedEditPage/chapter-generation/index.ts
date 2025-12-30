import { useState, useRef } from 'react';
import { OutlineData, OutlineItem } from '../../../types';
import { contentApi, ChapterContentRequest } from '../../../services/api';
import { updateItemContent } from '../outline';
import { matchAndFuseContent } from '../content';
import { searchKnowledgeBase } from '../knowledge-base';

// 章节生成状态管理
export interface GenerationProgress {
  total: number;
  completed: number;
  current: string;
  failed: string[];
  generating: Set<string>; // 正在生成的项目ID集合
}

// 基于知识库为单个章节生成内容（支持流式输出）
export const generateChapterContent = async (
  item: OutlineItem,
  outlineDataRef: React.RefObject<OutlineData | null>,
  updateOutline: (outlineData: OutlineData) => void,
  selectedKnowledgeBaseGroup: string,
  chapterRequirements: Record<string, string>,
  setIsStreaming: (isStreaming: boolean) => void,
  setIsGeneratingChapter: React.Dispatch<React.SetStateAction<Set<string>>>,
  setError: (error: string | null) => void,
  getEditorInstance: () => any,
  debouncedUpdateEditor: (content: string) => void
): Promise<boolean> => {
  const currentOutlineData = outlineDataRef.current;
  if (!currentOutlineData) return false;
  
  setIsStreaming(true); // 开始流式更新，禁用同步
  setIsGeneratingChapter(prev => { const newSet = new Set(prev); newSet.add(item.id); return newSet; });
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
  
  // 重试次数计数器
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000; // 1秒
  
  // 保存已生成的内容，用于恢复
  let savedGeneratedContent = '';
  
  // 记录上一次更新的内容，用于增量更新
  let lastUpdatedContent = '';
  
  // 初始化流式内容变量，确保在整个函数范围内可访问
  let generatedContent = savedGeneratedContent;
  
  try {
    // 1. 基于章节名称搜索知识库，使用选定的知识库分组
    const knowledgeBaseReferences = await searchKnowledgeBase(item.title, 10, selectedKnowledgeBaseGroup);
    
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
              debouncedUpdateEditor(savedGeneratedContent);
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
    // 结束流式更新，恢复同步
    setIsStreaming(false);
    
    // 取消请求
    controller.abort();
    setIsGeneratingChapter(prev => {
      const newSet = new Set(prev);
      newSet.delete(item.id);
      return newSet;
    });
  }
};

// 取消章节内容生成
export const cancelChapterGeneration = (
  itemId: string,
  generationControllersRef: React.RefObject<Record<string, AbortController>>,
  setIsGeneratingChapter: React.Dispatch<React.SetStateAction<Set<string>>>,
  setProgress: React.Dispatch<React.SetStateAction<GenerationProgress>>
) => {
  // 获取控制器并取消请求
  const controller = generationControllersRef.current[itemId];
  if (controller) {
    controller.abort();
    delete generationControllersRef.current[itemId];
    
    // 更新生成状态
    setIsGeneratingChapter((prev: Set<string>) => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
    
    // 更新进度状态（如果是在批量生成中）
    setProgress((prev: GenerationProgress) => {
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
export const handleGenerateContent = async (
  isGenerating: boolean,
  outlineDataRef: React.RefObject<OutlineData | null>,
  updateOutline: (outlineData: OutlineData) => void,
  collectLeafItems: (items: OutlineItem[]) => OutlineItem[],
  setIsGenerating: (isGenerating: boolean) => void,
  setProgress: React.Dispatch<React.SetStateAction<GenerationProgress>>,
  generateChapterContent: (item: OutlineItem) => Promise<boolean>
) => {
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
    setProgress((prev: GenerationProgress) => ({
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
      setProgress((prev: GenerationProgress) => {
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
      setProgress((prev: GenerationProgress) => {
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