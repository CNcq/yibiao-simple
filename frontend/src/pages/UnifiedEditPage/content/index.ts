import { useState, useRef, useCallback } from 'react';
import { contentApi, ChapterContentRequest } from '../../../services/api';
import { OutlineItem } from '../../../types';

/**
 * 内容匹配与融合算法
 */
export const matchAndFuseContent = (userRequirement: string, knowledgeBaseReferences: any[], chapterTitle: string): string => {
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
    promptContent += `请基于以下知识库资料，生成"${chapterTitle}"章节的详细内容：\n\n`;
    
    // 按文档相关性排序（这里简单按标题排序，实际项目中可根据内容相关性排序）
    const sortedReferences = [...knowledgeBaseReferences].sort((a, b) => {
      return (a.title || '').localeCompare(b.title || '');
    });
    
    sortedReferences.forEach((ref, index) => {
      promptContent += `${index + 1}. ${ref.title || '无标题参考资料'}\n   摘要：${ref.summary || '无摘要'}\n\n`;
    });
  }
  
  promptContent += `\n请严格按照以下要求生成内容：\n1. 内容必须紧密围绕章节标题"${chapterTitle}"展开\n2. 内容结构清晰，逻辑严谨，层次分明\n3. 语言正式、专业，符合标书的写作规范\n4. 确保内容的准确性和完整性\n5. 避免使用过于口语化的表达\n6. 如有需要，可以适当添加小标题以增强可读性\n7. 内容长度应适中，建议在500-1500字之间`;
  
  return promptContent;
};

/**
 * 章节内容生成函数
 */
export const useContentGeneration = (outlineDataRef: React.RefObject<any>, updateOutline: (outlineData: any) => void) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingChapter, setIsGeneratingChapter] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const generationControllersRef = useRef<Record<string, AbortController>>({});
  const generatedContentRef = useRef<Record<string, string>>({});

  /**
   * 生成单个章节的内容
   */
  const generateChapterContent = useCallback(async (item: OutlineItem, selectedKnowledgeBaseGroup: string): Promise<boolean> => {
    if (!outlineDataRef.current?.outline) return false;
    
    try {
      setIsStreaming(true);
      setIsGeneratingChapter(prev => new Set(prev).add(item.id));
      
      // 创建AbortController用于取消请求
      const controller = new AbortController();
      generationControllersRef.current[item.id] = controller;
      
      // 初始化生成的内容
      generatedContentRef.current[item.id] = '';
      
      // 构建请求参数
      const requestParams: ChapterContentRequest = {
        chapter: item,
        project_overview: '', // 后续可以从状态中获取
        prompt: '',
        parent_chapters: [],
        sibling_chapters: []
      };
      
      // 调用API获取流式响应
      const response = await contentApi.generateChapterContentStream(requestParams, controller.signal);
      
      // 创建读取器
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }
      
      // 处理流式响应
      let accumulatedContent = '';
      let isFirstChunk = true;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解析流数据
        const chunk = new TextDecoder('utf-8').decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            // 处理SSE格式的数据
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);
              
              if (data.content) {
                accumulatedContent += data.content;
                generatedContentRef.current[item.id] = accumulatedContent;
                
                // 仅在非流式更新期间更新编辑器内容
                // 这里需要与编辑器进行交互，可能需要通过回调函数传递
                
                // 更新outlineData
                let updatedOutline = [...outlineDataRef.current.outline];
                
                // 递归更新函数
                const updateItemContent = (items: OutlineItem[], itemId: string, content: string): OutlineItem[] => {
                  return items.map(item => {
                    if (item.id === itemId) {
                      return {
                        ...item,
                        content: content
                      };
                    }
                    if (item.children?.length) {
                      return {
                        ...item,
                        children: updateItemContent(item.children, itemId, content)
                      };
                    }
                    return item;
                  });
                };
                
                updatedOutline = updateItemContent(updatedOutline, item.id, accumulatedContent);
                
                // 更新父组件状态
                updateOutline({
                  ...outlineDataRef.current,
                  outline: updatedOutline
                });
              }
            }
          } catch (error) {
            console.error('解析流数据失败:', error);
          }
        }
      }
      
      return true;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log(`章节"${item.title}"的生成已取消`);
        return false;
      }
      
      console.error(`生成章节"${item.title}"内容失败:`, error);
      setError(`生成章节"${item.title}"内容失败: ${(error as Error).message}`);
      return false;
    } finally {
      setIsStreaming(false);
      setIsGeneratingChapter(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
      delete generationControllersRef.current[item.id];
    }
  }, [outlineDataRef, updateOutline]);

  /**
   * 取消内容生成
   */
  const cancelContentGeneration = useCallback((itemId: string) => {
    const controller = generationControllersRef.current[itemId];
    if (controller) {
      controller.abort();
      delete generationControllersRef.current[itemId];
      
      setIsGeneratingChapter(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      
      setIsStreaming(false);
    }
  }, []);

  return {
    generateChapterContent,
    cancelContentGeneration,
    isStreaming,
    isGeneratingChapter,
    error
  };
};
