#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""知识库分组管理服务 - 使用JSON文件存储分组信息"""

import json
import os
from typing import List, Dict, Any
from pathlib import Path
from datetime import datetime

# 获取应用数据目录
APP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA_DIR = os.path.join(APP_DIR, 'data')

# 确保数据目录存在
os.makedirs(DATA_DIR, exist_ok=True)

from .milvus_service import knowledge_base


class KnowledgeGroupManager:
    """知识库分组管理器 - 使用JSON文件存储分组信息"""
    
    def __init__(self):
        """初始化分组管理器"""
        # 获取知识库数据目录
        self.data_dir = Path(DATA_DIR)
        self.groups_file = self.data_dir / "knowledge_groups.json"
        
        # 确保分组文件存在
        self._ensure_groups_file()
    
    def _ensure_groups_file(self):
        """确保分组文件存在，如果不存在则创建"""
        if not self.groups_file.exists():
            initial_data = {
                "groups": [
                    {"name": "未分类", "description": "默认分组"}
                ],
                "group_documents": {}
            }
            
            with open(self.groups_file, 'w', encoding='utf-8') as f:
                json.dump(initial_data, f, ensure_ascii=False, indent=2)
    
    def _load_groups_data(self) -> Dict[str, Any]:
        """加载分组数据"""
        with open(self.groups_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _save_groups_data(self, data: Dict[str, Any]):
        """保存分组数据"""
        with open(self.groups_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def get_groups(self) -> List[str]:
        """获取所有知识库分组名称列表
        
        Returns:
            分组名称列表
        """
        data = self._load_groups_data()
        return [group["name"] for group in data["groups"]]
    
    def get_all_groups(self) -> List[Dict[str, Any]]:
        """获取所有知识库分组的完整信息
        
        Returns:
            分组信息列表，每个分组包含name、description和document_count字段
        """
        data = self._load_groups_data()
        
        # 为每个分组添加文档数量
        groups_with_count = []
        for group in data["groups"]:
            group_name = group["name"]
            # 获取该分组的文档数量
            document_count = len(data["group_documents"].get(group_name, []))
            # 添加文档数量到分组信息中
            groups_with_count.append({
                "name": group["name"],
                "description": group["description"],
                "document_count": document_count
            })
            
        return groups_with_count
    
    def get_group(self, group_name: str) -> Dict[str, Any]:
        """获取指定分组的信息
        
        Args:
            group_name: 分组名称
            
        Returns:
            分组信息字典，包含name、description和documents字段
        """
        data = self._load_groups_data()
        
        # 查找分组信息
        group_info = next((group for group in data["groups"] if group["name"] == group_name), None)
        if not group_info:
            return None
        
        # 获取该分组的文档ID列表
        doc_ids = data["group_documents"].get(group_name, [])
        
        # 从Milvus获取文档详细信息（只获取必要字段，不包含摘要）
        documents = []
        for doc_id in doc_ids:
            # 尝试从Milvus获取文档信息，只请求必要的字段
            # 注意：knowledge_base.get_document_by_id方法已经包含了集合加载逻辑
            doc_info = knowledge_base.get_document_by_id(doc_id, fields=['doc_id', 'section_title', 'title_path'])
            if doc_info:
                documents.append(doc_info)
            else:
                # 如果获取失败，返回一个包含doc_id的简单字典
                documents.append({"doc_id": doc_id})
        
        # 返回完整的分组信息
        return {
            "name": group_info["name"],
            "description": group_info["description"],
            "documents": documents
        }
    
    def add_group(self, group_name: str, description: str = "") -> bool:
        """添加新的知识库分组
        
        Args:
            group_name: 分组名称
            description: 分组描述
            
        Returns:
            bool: 添加成功返回True，已存在返回False
        """
        data = self._load_groups_data()
        
        # 检查分组是否已存在
        for group in data["groups"]:
            if group["name"] == group_name:
                return False
        
        # 添加新分组
        data["groups"].append({
            "name": group_name,
            "description": description
        })
        
        # 初始化该分组的文档列表
        if group_name not in data["group_documents"]:
            data["group_documents"][group_name] = []
        
        self._save_groups_data(data)
        return True
    
    def delete_group(self, group_name: str) -> bool:
        """删除指定的知识库分组及其所有文档
        
        Args:
            group_name: 分组名称
            
        Returns:
            bool: 删除成功返回True，不存在返回False
        """
        data = self._load_groups_data()
        
        # 检查分组是否存在
        group_exists = False
        for i, group in enumerate(data["groups"]):
            if group["name"] == group_name:
                # 从分组列表中删除
                del data["groups"][i]
                group_exists = True
                break
        
        if not group_exists:
            return False
        
        # 获取该分组的所有文档
        if group_name in data["group_documents"]:
            documents = data["group_documents"][group_name]
            
            # 从Milvus中删除所有文档
            for doc_id in documents:
                try:
                    knowledge_base.delete_document(doc_id)
                except Exception as e:
                    print(f"删除Milvus文档失败 {doc_id}: {e}")
            
            # 从分组文档映射中删除
            del data["group_documents"][group_name]
        
        # 不再自动重新创建"未分类"分组，允许用户完全删除它
        
        self._save_groups_data(data)
        return True
    
    def get_documents_by_group(self, group_name: str) -> List[str]:
        """获取指定分组的所有文档ID
        
        Args:
            group_name: 分组名称
            
        Returns:
            List[str]: 文档ID列表
        """
        data = self._load_groups_data()
        return data["group_documents"].get(group_name, [])
    
    def add_document_to_group(self, group_name: str, doc_id: str):
        """将文档添加到指定分组
        
        Args:
            group_name: 分组名称
            doc_id: 文档ID
        """
        data = self._load_groups_data()
        
        # 确保分组存在，不存在则创建
        group_exists = False
        for group in data["groups"]:
            if group["name"] == group_name:
                group_exists = True
                break
        
        if not group_exists:
            self.add_group(group_name)
            data = self._load_groups_data()
        
        # 确保分组文档映射存在
        if group_name not in data["group_documents"]:
            data["group_documents"][group_name] = []
        
        # 添加文档ID（避免重复）
        if doc_id not in data["group_documents"][group_name]:
            data["group_documents"][group_name].append(doc_id)
            self._save_groups_data(data)
    
    def remove_document_from_group(self, doc_id: str):
        """从所有分组中移除指定文档
        
        Args:
            doc_id: 文档ID
        """
        data = self._load_groups_data()
        
        # 遍历所有分组，移除文档ID
        for group_name, documents in data["group_documents"].items():
            if doc_id in documents:
                documents.remove(doc_id)
        
        self._save_groups_data(data)


# 创建全局知识库分组管理器实例
knowledge_group_manager = KnowledgeGroupManager()
