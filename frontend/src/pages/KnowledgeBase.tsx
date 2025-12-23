/**
 * 知识库管理页面
 */
import React, { useState, useEffect, useCallback } from 'react';
import { knowledgeBaseApi } from '../services/api';

// 知识库分组接口
interface KnowledgeBaseGroup {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

// 知识库文档接口
interface KnowledgeBaseDocument {
  id: string;
  docId: string;
  sectionTitle: string;
  summary: string;
  titlePath: string;
  groupId: string;
  createdAt: string;
}

const KnowledgeBase: React.FC = () => {
  // 状态管理
  const [groups, setGroups] = useState<KnowledgeBaseGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeBaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false); // 独立的创建分组加载状态
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  // 错误消息自动消失效果
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 成功消息自动消失效果
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // 加载指定分组的文档
  const loadDocuments = useCallback(async (groupId: string) => {
    // 验证groupId参数
    if (!groupId) {
      console.error('无法加载文档：分组ID无效');
      setError('分组ID无效，请先选择一个有效的分组');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      // 调用API获取真实的文档数据，添加分页参数
      const limit = 100; // 设置一个合理的默认值
      const response = await knowledgeBaseApi.getDocumentsByGroup(groupId, limit);
      
      if (!response?.data?.documents) {
        // 没有文档数据，直接返回空列表
        setDocuments([]);
        return;
      }
      
      const docs = response.data.documents;
      
      // 转换为前端需要的格式
      const realDocuments = docs.map((doc: any, index: number) => ({
        id: doc.doc_id || `doc_${index}`,
        docId: doc.doc_id || `doc_${index}`,
        sectionTitle: doc.section_title || doc.file_name || doc.title || '未命名文档',
        summary: doc.summary || '暂无摘要信息',
        titlePath: doc.section_title || doc.file_name || doc.title, // 尝试使用文件名作为标题路径
        groupId: groupId,
        createdAt: new Date().toISOString() // 后端API暂不支持创建时间
      }));
      
      setDocuments(realDocuments);
    } catch (err) {
      console.error('加载知识库文档失败:', err);
      // 清空文档列表，确保界面状态一致
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载知识库分组
  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 调用API获取真实的分组数据
      const response = await knowledgeBaseApi.getKnowledgeBaseGroups();
      console.log('删除后从后端获取的分组列表:', response.data.groups);
      const groups = response.data.groups;
      
      // 处理分组数据，使用后端返回的文档数量
      const realGroups = groups.map((group: any) => ({
        id: group.name,
        name: group.name,
        description: group.description || '',
        createdAt: new Date().toISOString(), // 后端API暂不支持创建时间
        updatedAt: new Date().toISOString(), // 后端API暂不支持更新时间
        documentCount: group.document_count || 0 // 使用后端返回的文档数量
      }));
      
      console.log('处理后的分组列表:', realGroups);
      setGroups(realGroups);
      
      // 默认选择第一个分组
      if (realGroups.length > 0 && !selectedGroup) {
        setSelectedGroup(realGroups[0].id);
        loadDocuments(realGroups[0].id);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载知识库分组失败';
      setError(`加载分组失败: ${errorMsg}`);
      console.error('加载知识库分组失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup, loadDocuments]);

  // 初始化加载数据
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // 选择分组
  const handleGroupSelect = (groupId: string) => {
    setSelectedGroup(groupId);
    loadDocuments(groupId);
  };

  // 创建新分组
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setError('分组名称不能为空');
      return;
    }

    const groupName = newGroupName.trim();
    setIsCreatingGroup(true); // 设置独立的创建分组加载状态
    setError(null);
    
    try {
      // 调用API创建真实的分组
      await knowledgeBaseApi.addKnowledgeBaseGroup(groupName);
      
      // 立即将新分组添加到状态中，不等待完整的loadGroups
      const newGroup = {
        id: groupName,
        name: groupName,
        description: newGroupDescription || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documentCount: 0
      };
      
      // 更新分组列表
      setGroups(prevGroups => [...prevGroups, newGroup]);
      
      // 立即选择新创建的分组
      setSelectedGroup(groupName);
      
      // 直接设置空文档列表，不调用loadDocuments（进一步减少加载时间）
      setDocuments([]);
      
      // 重置表单
      setNewGroupName('');
      setNewGroupDescription('');
      setShowGroupModal(false);
      setSuccess(`分组「${groupName}」创建成功`);
      
      // 后台异步刷新完整的分组列表（可选，确保数据一致性）
      setTimeout(() => {
        loadGroups().catch(err => {
          console.error('后台刷新分组列表失败:', err);
        });
      }, 500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '创建分组失败';
      setError(`创建分组失败: ${errorMsg}`);
      console.error('创建分组失败:', err);
      // 发生错误时，仍尝试刷新分组列表以确保数据一致性
      await loadGroups();
    } finally {
      // 确保在任何情况下都能结束创建分组的加载状态
      setIsCreatingGroup(false);
    }
  };

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedGroup) {
      setError('请先选择一个分组');
      return;
    }

    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadedFile = files[0];
    console.log('正在上传文件:', uploadedFile.name);

    setIsLoading(true);
    setError(null);
    try {
      // 确保selectedGroup是字符串
      if (!selectedGroup) {
        setError('请先选择一个分组');
        return;
      }
      
      // 调用API上传文件
      await knowledgeBaseApi.uploadDocumentToGroup(selectedGroup, uploadedFile);
      
      // 延迟更长时间后重新加载，确保后端已完成文件处理和索引
      setTimeout(async () => {
        // 重新加载分组列表以更新文档计数
        await loadGroups();
        
        // 重新加载文档
        await loadDocuments(selectedGroup);
      }, 2000); // 2000毫秒延迟，增加到足够时间确保后端处理完成
      
      // 重置文件输入
      event.target.value = '';
      
      setSuccess('文件上传成功');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '文件上传失败';
      setError(`文件上传失败: ${errorMsg}`);
      console.error('文件上传失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 删除文档
  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('确定要删除这个文档吗？')) return;

    setIsLoading(true);
    setError(null);
    try {
      // 调用API删除文档
      await knowledgeBaseApi.deleteDocument(docId);
      
      // 更新文档列表
      setDocuments(documents.filter(doc => doc.id !== docId));
      
      // 重新加载分组列表以更新文档计数
      await loadGroups();
      setSuccess('文档删除成功');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '删除文档失败';
      setError(`删除文档失败: ${errorMsg}`);
      console.error('删除文档失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 删除分组
  const handleDeleteGroup = async (groupId: string) => {
    console.log('开始删除分组:', groupId);
    // 防止删除当前选中的分组，如果是当前选中的分组，先清空选中状态
    if (selectedGroup === groupId) {
      setSelectedGroup(null);
      setDocuments([]);
    }

    setIsLoading(true);
    setError(null);
    try {
      // 调用API删除分组
      await knowledgeBaseApi.deleteKnowledgeBaseGroup(groupId);
      console.log('API删除分组成功');
      
      // 重新加载分组列表以确保数据一致
      console.log('开始重新加载分组列表');
      await loadGroups();
      
      setSuccess('分组删除成功');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '删除分组失败';
      setError(`删除分组失败: ${errorMsg}`);
      console.error('删除分组失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 搜索文档
  const handleSearch = async (query: string) => {
    // 清空之前的搜索结果
    setSearchResults([]);
    
    // 如果查询为空，显示所有文档
    if (!query.trim()) {
      if (selectedGroup) {
        loadDocuments(selectedGroup);
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // 调用API搜索文档
      const topK = 100; // 搜索结果数量
      const results = await knowledgeBaseApi.searchKnowledgeBase(query, topK, selectedGroup || undefined);
      
      if (!results?.data?.documents) {
        throw new Error('无效的搜索结果格式');
      }
      
      // 转换搜索结果为前端需要的格式
      const searchDocs = results.data.documents.map((doc: any, index: number) => ({
        id: doc.doc_id || `search_doc_${index}`,
        docId: doc.doc_id || `search_doc_${index}`,
        sectionTitle: doc.section_title || doc.file_name || doc.title || '未命名文档',
        summary: doc.summary || '暂无摘要信息',
        titlePath: doc.section_title || doc.file_name || doc.title,
        groupId: doc.group_name || selectedGroup || '',
        createdAt: new Date().toISOString()
      }));
      
      // 更新搜索结果
      setSearchResults(searchDocs);
      setSuccess(`找到 ${searchDocs.length} 个匹配的文档`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '搜索文档失败';
      setError(`搜索文档失败: ${errorMsg}`);
      console.error('搜索文档失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 页面标题 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">知识库管理</h1>
        <button
          onClick={() => setShowGroupModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          创建分组
        </button>
      </div>

      {/* 成功信息 */}
      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
          {success}
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 分组列表 */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">知识库分组</h2>
            <div className="space-y-2">
              {groups.map(group => (
                <div
                  key={group.id}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${selectedGroup === group.id ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100 border border-transparent'}`}
                >
                  <div className="flex justify-between items-start">
                    <div onClick={() => handleGroupSelect(group.id)} className="flex-1">
                      <div className="font-medium">{group.name}</div>
                      <div className="text-sm text-gray-500">{group.description}</div>
                      <div className="text-xs text-gray-400 mt-1 document-count transition-all duration-300 ease-in-out">{group.documentCount} 个文档</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // 防止触发分组选择
                        if (window.confirm(`确定要删除分组「${group.name}」吗？删除后该分组下的所有文档也将被删除。`)) {
                          handleDeleteGroup(group.id);
                        }
                      }}
                      className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                      title="删除分组"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 文档管理 */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-4">
            {/* 分组信息和操作 */}
            {selectedGroup && (
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {groups.find(g => g.id === selectedGroup)?.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {groups.find(g => g.id === selectedGroup)?.description}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {/* 搜索框 */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="搜索文档..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch(e.currentTarget.value);
                        }
                      }}
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            if (selectedGroup) {
                              loadDocuments(selectedGroup);
                            }
                          }}
                          className="text-gray-400 hover:text-gray-600"
                          title="清空搜索"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleSearch(searchQuery)}
                        className="text-gray-400 hover:text-gray-600"
                        title="执行搜索"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* 上传文件按钮 */}
                  <label className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 cursor-pointer">
                    上传文件
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 文档列表 */}
            {/* 对于新创建的分组，直接显示空状态而不是加载动画 */}
            {isLoading && !(selectedGroup && groups.some(group => group.id === selectedGroup && group.documentCount === 0)) ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">加载中...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">搜索结果</h3>
                  <span className="text-sm text-gray-500">共找到 {searchResults.length} 个文档</span>
                </div>
                {searchResults.map(doc => (
                  <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{doc.sectionTitle}</h3>
                        <p className="text-sm text-gray-500 mt-1">{doc.titlePath}</p>
                        {doc.summary && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{doc.summary}</p>
                        )}
                        {doc.groupId && (
                          <div className="text-xs text-blue-500 mt-1">
                            分组: {groups.find(g => g.id === doc.groupId)?.name || doc.groupId}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-500 hover:text-red-700 focus:outline-none"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      上传时间: {new Date(doc.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {selectedGroup ? '该分组中暂无文档，请上传文件。' : '请先选择一个分组。'}
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map(doc => (
                  <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{doc.sectionTitle}</h3>
                        <p className="text-sm text-gray-500 mt-1">{doc.titlePath}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-500 hover:text-red-700 focus:outline-none"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      上传时间: {new Date(doc.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 创建分组模态框 */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">创建知识库分组</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分组名称</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入分组名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分组描述</label>
                <textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入分组描述"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                取消
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                {isCreatingGroup ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;