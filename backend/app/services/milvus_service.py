#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Milvus 知识库服务"""

import os
import json
import numpy as np
from typing import List, Dict, Any, Optional

# 设置Hugging Face国内镜像地址
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

from pymilvus import connections, utility, Collection, FieldSchema, CollectionSchema, DataType
from sentence_transformers import SentenceTransformer

# 导入应用配置
from ..config import settings


class MilvusKnowledgeBase:
    """Milvus 知识库管理服务"""
    
    def __init__(self):
        """初始化 Milvus 连接和模型"""
        # 检查是否启用Milvus
        self.enable_milvus = settings.enable_milvus
        if not self.enable_milvus:
            print("Milvus功能已禁用")
            return
            
        # Milvus 连接配置
        self.milvus_uri = settings.milvus_uri
        self.collection_name = settings.milvus_collection_name
        self.index_type = settings.milvus_index_type
        self.index_params = settings.milvus_index_params
        self.search_params = settings.milvus_search_params
        
        # 全局集合实例
        self.collection = None
        
        # 初始化嵌入模型
        # self.embedding_model = SentenceTransformer('Qwen/Qwen3-Embedding-0.6')
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # 连接Milvus服务器
        self.connect()
        
        # 创建集合（如果不存在）
        self.create_collection()
        
        # 初始化集合实例
        self._init_collection()
    
    def _init_collection(self):
        """初始化集合实例"""
        if not self.enable_milvus:
            return
        
        self.collection = Collection(name=self.collection_name)
        # 直接加载集合，不检查is_loaded属性（因为SDK版本不支持）
        self.collection.load()
        print(f"集合 {self.collection_name} 已加载")
    
    def connect(self):
        """连接到Milvus服务器"""
        # 检查是否已存在连接
        if "default" in connections.list_connections():
            connections.disconnect("default")
        
        # 连接到Milvus服务器
        connections.connect(
            alias="default",
            uri=self.milvus_uri
        )
        print(f"成功连接到Milvus服务器: {self.milvus_uri}")
    
    def create_collection(self):
        """创建知识库集合"""
        # 向量维度设置为与嵌入模型匹配
        # all-MiniLM-L6-v2 的维度是 384
        embedding_dimension = 384
        
        # 如果集合不存在则创建
        if not utility.has_collection(self.collection_name):
            # 定义字段
            fields = [
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),  # 自增主键
                FieldSchema(name="doc_id", dtype=DataType.VARCHAR, max_length=512),  # 原始文档唯一标识
                FieldSchema(name="section_title", dtype=DataType.VARCHAR, max_length=512),  # 章节标题
                FieldSchema(name="summary", dtype=DataType.VARCHAR, max_length=8192),  # 章节概述
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=embedding_dimension),  # 向量嵌入
                FieldSchema(name="title_path", dtype=DataType.VARCHAR, max_length=1024)  # 章节层级
            ]
            
            # 创建集合模式
            schema = CollectionSchema(fields=fields, description="投标知识库")
            
            # 创建集合
            collection = Collection(name=self.collection_name, schema=schema)
            print(f"成功创建集合: {self.collection_name}")
            
            # 创建向量索引，添加度量类型（对于SentenceTransformer向量通常使用COSINE）
            collection.create_index(
                field_name="embedding",
                index_params={"index_type": self.index_type, "metric_type": "COSINE", **self.index_params}
            )
            print(f"成功创建向量索引: {self.index_type}")
            
            # 为section_title字段创建倒排索引，支持关键词检索
            collection.create_index(
                field_name="section_title",
                index_params={"index_type": "Trie"}
            )
            print("成功为section_title创建倒排索引: Trie")
            
            # 加载集合
            collection.load()
            print(f"集合 {self.collection_name} 已加载")
        else:
            print(f"集合已存在: {self.collection_name}")
            # 确保已存在的集合也被加载
            collection = Collection(name=self.collection_name)
            collection.load()
            print(f"集合 {self.collection_name} 已加载")
    
    def add_documents(self, documents: List[Dict[str, Any]]):
        """向知识库添加文档
        
        Args:
            documents: 文档列表，每个文档包含 doc_id, section_title, summary, title_path 字段
        """
        if not documents:
            return
        
        # 生成文本嵌入 - 使用 summary 作为嵌入源
        summaries = [str(doc['summary']) for doc in documents]
        embeddings = self.embedding_model.encode(summaries, convert_to_numpy=True).tolist()
        
        # 准备插入数据
        data = [
            [str(doc.get('doc_id', '')) for doc in documents],
            [str(doc.get('section_title', '')) for doc in documents],
            [str(doc.get('summary', '')) for doc in documents],
            embeddings,
            [str(doc.get('title_path', '')) for doc in documents]
        ]
        
        # 插入数据
        collection = Collection(name=self.collection_name)
        collection.insert(data)
        print(f"成功添加 {len(documents)} 个文档到知识库")
    
    def search(self, query: str, top_k: int = 5, keyword: str = None) -> List[Dict[str, Any]]:
        """搜索知识库 - 混合检索（向量 + 标题关键词）
        
        Args:
            query: 查询文本
            top_k: 返回结果数量
            keyword: 标题关键词，用于精确匹配章节标题
            
        Returns:
            搜索结果列表，包含 doc_id, section_title, summary, title_path, score 字段
        """
        # 生成查询嵌入
        query_embedding = self.embedding_model.encode([query], convert_to_numpy=True).tolist()
        
        # 加载集合
        collection = Collection(name=self.collection_name)
        
        # 检查索引是否存在，如果不存在则创建
        indexes = collection.indexes
        if len(indexes) < 2:  # 需要向量索引和标题倒排索引
            print("索引不存在，正在创建...")
            # 创建向量索引
            collection.create_index(
                field_name="embedding",
                index_params={"index_type": self.index_type, "metric_type": "COSINE", **self.index_params}
            )
            print(f"成功创建向量索引: {self.index_type}")
            
            # 创建标题倒排索引
            collection.create_index(
                field_name="section_title",
                index_params={"index_type": "Trie"}
            )
            print("成功为section_title创建倒排索引: Trie")
        
        # 加载集合
        collection.load()
        
        # 构建查询表达式
        expr_parts = []
        if keyword:
            expr_parts.append(f"section_title LIKE '%{keyword}%'")
        
        expr = " AND ".join(expr_parts) if expr_parts else None
        
        # 执行搜索 - 混合检索
        results = collection.search(
            data=[query_embedding[0]],
            anns_field="embedding",
            param=self.search_params,
            limit=top_k,
            output_fields=['doc_id', 'section_title', 'summary', 'title_path'],
            expr=expr  # 添加过滤条件
        )
        
        # 处理搜索结果
        search_results = []
        for hits in results:
            for hit in hits:
                search_results.append({
                    'doc_id': hit.entity.get('doc_id'),
                    'section_title': hit.entity.get('section_title'),
                    'summary': hit.entity.get('summary'),
                    'title_path': hit.entity.get('title_path'),
                    'score': hit.score
                })
        
        return search_results
    
    def get_reference_sections(self, section_title: str, section_content: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """获取用于生成章节内容的参考章节
        
        根据输入的章节标题和内容，在知识库中搜索相似的章节，
        结合标题关键词匹配和内容向量相似性，返回最相关的章节供参考。
        
        Args:
            section_title: 要生成的章节标题
            section_content: 要生成的章节内容（或大纲）
            top_k: 返回参考章节数量
            
        Returns:
            参考章节列表，包含 doc_id, section_title, summary, title_path, score 字段
        """
        # 提取标题中的关键词（这里简化处理，直接使用整个标题作为关键词）
        # 更复杂的实现可以使用NLP工具提取关键词
        title_keyword = section_title
        
        # 使用章节内容生成查询向量
        query_text = f"{section_title} {section_content}"
        
        # 使用混合检索获取参考章节
        reference_sections = self.search(query_text, top_k=top_k, keyword=title_keyword)
        
        print(f"为章节 '{section_title}' 找到 {len(reference_sections)} 个参考章节")
        
        return reference_sections
    
    def delete_document(self, doc_id: str):
        """删除指定 ID 的文档"""
        if not self.enable_milvus:
            return
        
        # 直接创建新的Collection实例并立即加载
        collection = Collection(name=self.collection_name)
        collection.load()  # 强制加载集合
        print(f"集合 {self.collection_name} 已加载，准备删除文档")
        
        # 执行删除操作
        collection.delete(f"doc_id == '{doc_id}'")
        print(f"成功删除文档: {doc_id}")
        
        # 不需要卸载集合，保持加载状态
    
    def get_document_count(self) -> int:
        """获取知识库中文档数量"""
        collection = Collection(name=self.collection_name)
        collection.load()
        return collection.num_entities
    
    def get_document_by_id(self, doc_id: str, fields: List[str] = ['doc_id', 'section_title', 'summary', 'title_path']) -> Optional[Dict[str, Any]]:
        """根据文档 ID 获取文档信息
        
        Args:
            doc_id: 文档 ID
            fields: 需要返回的字段列表，默认为所有字段
            
        Returns:
            文档信息字典，如果不存在则返回 None
        """
        collection = Collection(name=self.collection_name)
        # 确保集合已加载
        collection.load()
        
        # 构建查询条件
        expr = f"doc_id == '{doc_id}'"
        
        # 执行查询
        results = collection.query(
            expr=expr,
            output_fields=fields
        )
        
        if results and len(results) > 0:
            return results[0]
        return None
    
    
    def clear_all_documents(self):
        """清空知识库所有文档"""
        collection = Collection(name=self.collection_name)
        collection.drop()
        print("删除集合成功")
        
        # 重新创建集合
        self.create_collection()
        
        # 加载重新创建的集合
        collection = Collection(name=self.collection_name)
        collection.load()
        print(f"集合 {self.collection_name} 已加载")
        print("成功清空知识库")


# 创建全局知识库实例
knowledge_base = MilvusKnowledgeBase()