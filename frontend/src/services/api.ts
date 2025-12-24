/**
 * API服务
 */
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 调整为60秒
});

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API请求错误:', error);
    return Promise.reject(error);
  }
);

export interface ConfigData {
  api_key: string;
  base_url?: string;
  model_name: string;
}

export interface FileUploadResponse {
  success: boolean;
  message: string;
  file_content?: string;
  old_outline?: string;
}

export interface AnalysisRequest {
  file_content: string;
  analysis_type: 'overview' | 'requirements';
}

export interface OutlineRequest {
  overview: string;
  requirements: string;
  uploaded_expand?: boolean;
  old_outline?: string;
  old_document?: string;
}

export interface ContentGenerationRequest {
  outline: { outline: any[] };
  project_overview: string;
}

export interface ChapterContentRequest {
  chapter: any;
  parent_chapters?: any[];
  sibling_chapters?: any[];
  project_overview: string;
  prompt?: string;
}

// 配置相关API
export const configApi = {
  // 保存配置
  saveConfig: (config: ConfigData) =>
    api.post('/api/config/save', config),

  // 加载配置
  loadConfig: () =>
    api.get('/api/config/load'),

  // 获取可用模型
  getModels: (config: ConfigData) =>
    api.post('/api/config/models', config),
};

// 文档相关API
export const documentApi = {
  // 上传文件
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<FileUploadResponse>('/api/document/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },


  // 流式分析文档
  analyzeDocumentStream: (data: AnalysisRequest) =>
    fetch(`${API_BASE_URL}/api/document/analyze-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }),

  // 导出Word文档
  exportWord: (data: any) =>
    fetch(`${API_BASE_URL}/api/document/export-word`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }),
};

// 目录相关API
export const outlineApi = {
  // 生成目录
  generateOutline: (data: OutlineRequest) =>
    api.post('/api/outline/generate', data),

  // 流式生成目录
  generateOutlineStream: (data: OutlineRequest) =>
    fetch(`${API_BASE_URL}/api/outline/generate-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }),

};

// 内容相关API
export const contentApi = {
  // 生成单章节内容
  generateChapterContent: (data: ChapterContentRequest) =>
    api.post('/api/content/generate-chapter', data),

  // 流式生成单章节内容
  generateChapterContentStream: (data: ChapterContentRequest, signal?: AbortSignal) => {
    const timeout = 300000; // 5分钟超时时间
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // 如果传入了外部的signal，则监听其abort事件
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }

    return fetch(`${API_BASE_URL}/api/content/generate-chapter-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  },
  
  // 取消正在进行的生成任务
  cancelGeneration: (taskId: string) =>
    api.post('/api/content/cancel-generation', { task_id: taskId }),
};

// 方案扩写相关API
export const expandApi = {
  // 上传方案扩写文件
  uploadExpandFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<FileUploadResponse>('/api/expand/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 文件上传专用超时设置：5分钟
    });
  },
};

// 知识库相关API
export const knowledgeBaseApi = {
  // 添加文档
  addDocuments: (documents: any[]) =>
    api.post('/api/knowledge-base/documents', documents),

  // 删除文档
  deleteDocument: (docId: string) =>
    api.delete('/api/knowledge-base/documents', { params: { doc_id: docId } }),

  // 搜索知识库
  searchKnowledgeBase: (query: string, topK: number = 5, groupName?: string) =>
    api.get('/api/knowledge-base/search', {
      params: { query, top_k: topK, groupName }
    }),

  // 获取知识库统计信息
  getKnowledgeBaseStats: () =>
    api.get('/api/knowledge-base/stats'),

  // 清空知识库
  clearKnowledgeBase: () =>
    api.delete('/api/knowledge-base/clear'),
  
  // 获取所有知识库分组
  getKnowledgeBaseGroups: () =>
    api.get('/api/knowledge-base/groups'),
  
  // 添加新的知识库分组
  addKnowledgeBaseGroup: (groupName: string) =>
    api.post('/api/knowledge-base/groups', null, {
      params: { group_name: groupName }
    }),
  
  // 删除知识库分组
  deleteKnowledgeBaseGroup: (groupName: string) =>
    api.delete(`/api/knowledge-base/groups/${groupName}`),
  
  // 获取指定分组的文档
  getDocumentsByGroup: (groupName: string, limit: number = 100) =>
    api.get(`/api/knowledge-base/groups/${groupName}/documents`, {
      params: { limit }
    }),
  
  // 上传文件到指定分组
  uploadDocumentToGroup: (groupName: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/knowledge-base/upload/${groupName}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
};

export default api;