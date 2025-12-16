#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Milvus 知识库服务"""

import os
import json
import numpy as np
from typing import List, Dict, Any, Optional
from pymilvus import (connections, FieldSchema, CollectionSchema, DataType, 
                     Collection, utility)
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
        
        # 连接 Milvus
        self.connect()
        
        # 初始化嵌入模型
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # 创建集合（如果不存在）
        self.create_collection()
    
    def connect(self):
        """连接到 Milvus 服务"""
        try:
            # 使用配置的URI连接Milvus
            connections.connect(alias='default', uri=self.milvus_uri)
            print(f"成功连接到 Milvus: {self.milvus_uri}")
        except Exception as e:
            print(f"连接 Milvus 失败: {str(e)}")
            raise
    
    def create_collection(self):
        """创建知识库集合"""
        # 向量维度设置为与嵌入模型匹配
        # all-MiniLM-L6-v2 的维度是 384
        embedding_dimension = 384
        
        fields = [
            FieldSchema(name='id', dtype=DataType.INT64, is_primary=True, auto_id=True),
            FieldSchema(name='content', dtype=DataType.VARCHAR, max_length=10000),
            FieldSchema(name='title', dtype=DataType.VARCHAR, max_length=200),
            FieldSchema(name='embedding', dtype=DataType.FLOAT_VECTOR, dim=embedding_dimension),
            FieldSchema(name='metadata', dtype=DataType.JSON)
        ]
        
        schema = CollectionSchema(fields=fields, description='投标知识库')
        
        # 如果集合不存在则创建
        if not utility.has_collection(self.collection_name):
            self.collection = Collection(name=self.collection_name, schema=schema)
            
            # 创建索引
            index_params = {
                'index_type': settings.milvus_index_type,
                'metric_type': 'L2',  # 使用 Milvus 支持的 L2 欧氏距离作为度量类型
                'params': settings.milvus_index_params
            }
            self.collection.create_index(field_name='embedding', index_params=index_params)
            print(f"成功创建集合: {self.collection_name}")
        else:
            self.collection = Collection(name=self.collection_name)
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
        content_list = [str(doc.get('content', '')) for doc in documents]
        title_list = [str(doc.get('title', '')) for doc in documents]
        metadata_list = [doc.get('metadata', {}) for doc in documents]
        

        
        # 使用列表格式插入数据
        data = [
            content_list,
            title_list,
            embeddings,
            metadata_list
        ]
        
        # 插入数据
        self.collection.insert(data)
        self.collection.flush()
        print(f"成功添加 {len(documents)} 个文档到知识库")
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """搜索知识库
        
        Args:
            query: 查询文本
            top_k: 返回结果数量
            
        Returns:
            搜索结果列表，包含 content, title, score 字段
        """
        # 检查并创建索引
        indexes = self.collection.indexes
        if not indexes:
            print("索引不存在，正在创建...")
            index_params = {
                'index_type': settings.milvus_index_type,
                'metric_type': 'L2',
                'params': settings.milvus_index_params
            }
            self.collection.create_index(field_name='embedding', index_params=index_params)
            print("索引创建成功")
        
        # 生成查询嵌入
        query_embedding = self.embedding_model.encode([query], convert_to_numpy=True).tolist()
        
        # 搜索参数
        search_params = {
            'metric_type': 'L2',  # 使用 L2 欧氏距离作为度量类型（与索引一致）
            'params': settings.milvus_search_params
        }
        
        # 执行搜索
        self.collection.load()
        results = self.collection.search(
            data=query_embedding,
            anns_field='embedding',
            param=search_params,
            limit=top_k,
            output_fields=['content', 'title', 'metadata']
        )
        
        # 处理搜索结果
        search_results = []
        for hits in results:
            for hit in hits:
                search_results.append({
                    'content': hit.entity.get('content'),
                    'title': hit.entity.get('title'),
                    'score': hit.score,
                    'metadata': hit.entity.get('metadata')
                })
        
        return search_results
    
    def delete_document(self, doc_id: int):
        """删除指定 ID 的文档"""
        expr = f"id == {doc_id}"
        self.collection.delete(expr)
        print(f"成功删除文档: {doc_id}")
    
    def get_document_count(self) -> int:
        """获取知识库中文档数量"""
        return self.collection.num_entities
    
    def clear_all_documents(self):
        """清空知识库所有文档"""
        # 直接删除集合
        self.collection.drop()
        print("删除集合成功")
        
        # 重新创建集合
        self.create_collection()
        print("重新创建集合成功")
        print("成功清空知识库")


# 创建全局知识库实例
knowledge_base = MilvusKnowledgeBase()
