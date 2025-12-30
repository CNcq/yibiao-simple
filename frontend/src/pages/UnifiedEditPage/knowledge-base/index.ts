import { useState, useEffect } from 'react';
import { knowledgeBaseApi } from '../../../services/api';

export interface KnowledgeBaseGroup {
  name: string;
  description: string;
  document_count: number;
}

// 获取知识库分组
export const useKnowledgeBaseGroups = () => {
  const [knowledgeBaseGroups, setKnowledgeBaseGroups] = useState<KnowledgeBaseGroup[]>([]);
  const [selectedKnowledgeBaseGroup, setSelectedKnowledgeBaseGroup] = useState<string>('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return {
    knowledgeBaseGroups,
    selectedKnowledgeBaseGroup,
    setSelectedKnowledgeBaseGroup,
    isLoadingGroups,
    error
  };
};

// 搜索知识库
export const searchKnowledgeBase = async (
  query: string,
  limit: number,
  groupName: string
) => {
  try {
    const response = await knowledgeBaseApi.searchKnowledgeBase(query, limit, groupName);
    return response.data.results || [];
  } catch (error) {
    console.error('搜索知识库失败:', error);
    return [];
  }
};