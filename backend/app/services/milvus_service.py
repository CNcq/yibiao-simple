#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Milvus 知识库服务"""

import os
import json
import numpy as np
from typing import List, Dict, Any, Optional
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
        
        # 初始化嵌入模型
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # 连接Milvus服务器
        self.connect()
        
        # 创建集合（如果不存在）
        self.create_collection()
    
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
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
                FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=4096),
                FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=256),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=embedding_dimension),
                FieldSchema(name="metadata", dtype=DataType.JSON)
            ]
            
            # 创建集合模式
            schema = CollectionSchema(fields=fields, description="投标知识库")
            
            # 创建集合
            collection = Collection(name=self.collection_name, schema=schema)
            print(f"成功创建集合: {self.collection_name}")
            
            # 创建索引，添加度量类型（对于SentenceTransformer向量通常使用COSINE）
            collection.create_index(
                field_name="embedding",
                index_params={"index_type": self.index_type, "metric_type": "COSINE", **self.index_params}
            )
            print(f"成功创建索引: {self.index_type}")
        else:
            print(f"集合已存在: {self.collection_name}")
    
    def add_documents(self, documents: List[Dict[str, Any]]):
        """向知识库添加文档
        
        Args:
            documents: 文档列表，每个文档包含 content, title, metadata 字段
        """
        if not documents:
            return
        
        # 生成文本嵌入
        contents = [str(doc['content']) for doc in documents]
        embeddings = self.embedding_model.encode(contents, convert_to_numpy=True).tolist()
        
        # 准备插入数据
        data = [
            [str(doc.get('content', '')) for doc in documents],
            [str(doc.get('title', '')) for doc in documents],
            embeddings,
            [doc.get('metadata', {}) for doc in documents]
        ]
        
        # 插入数据
        collection = Collection(name=self.collection_name)
        collection.insert(data)
        print(f"成功添加 {len(documents)} 个文档到知识库")
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """搜索知识库
        
        Args:
            query: 查询文本
            top_k: 返回结果数量
            
        Returns:
            搜索结果列表，包含 content, title, score 字段
        """
        # 生成查询嵌入
        query_embedding = self.embedding_model.encode([query], convert_to_numpy=True).tolist()
        
        # 加载集合
        collection = Collection(name=self.collection_name)
        
        # 检查索引是否存在，如果不存在则创建
        indexes = collection.indexes
        if not indexes:
            print("索引不存在，正在创建...")
            collection.create_index(
                field_name="embedding",
                index_params={"index_type": self.index_type, "metric_type": "COSINE", **self.index_params}
            )
            print(f"成功创建索引: {self.index_type}")
        
        # 加载集合
        collection.load()
        
        # 执行搜索
        results = collection.search(
            data=[query_embedding[0]],
            anns_field="embedding",
            param=self.search_params,
            limit=top_k,
            output_fields=['content', 'title']
        )
        
        # 处理搜索结果
        search_results = []
        for hits in results:
            for hit in hits:
                search_results.append({
                    'content': hit.entity.get('content'),
                    'title': hit.entity.get('title'),
                    'score': hit.score
                })
        
        return search_results
    
    def delete_document(self, doc_id: int):
        """删除指定 ID 的文档"""
        collection = Collection(name=self.collection_name)
        collection.delete(f"id == {doc_id}")
        print(f"成功删除文档: {doc_id}")
    
    def get_document_count(self) -> int:
        """获取知识库中文档数量"""
        collection = Collection(name=self.collection_name)
        return collection.num_entities
    
    def clear_all_documents(self):
        """清空知识库所有文档"""
        collection = Collection(name=self.collection_name)
        collection.drop()
        print("删除集合成功")
        
        # 重新创建集合
        self.create_collection()
        print("重新创建集合成功")
        print("成功清空知识库")


# 创建全局知识库实例
knowledge_base = MilvusKnowledgeBase()