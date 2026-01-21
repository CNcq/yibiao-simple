#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""知识库管理API路由"""

import uuid
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from typing import List, Dict, Any

from ..services.milvus_service import knowledge_base
from ..services.knowledge_group_manager import KnowledgeGroupManager
from ..services.file_service import FileService

router = APIRouter(prefix="/api/knowledge-base", tags=["知识库管理"])

# 创建分组管理器实例
group_manager = KnowledgeGroupManager()


@router.post("/documents")
async def add_documents(documents: List[Dict[str, Any]]):
    """向知识库添加文档
    
    Args:
        documents: 文档列表，每个文档包含 content, title, metadata 字段
    
    Returns:
        操作结果
    """
    try:
        knowledge_base.add_documents(documents)
        return {"success": True, "message": f"成功添加 {len(documents)} 个文档到知识库"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"添加文档失败: {str(e)}")


@router.delete("/documents")
async def delete_document(doc_id: str = Query(..., description="文档ID")):
    """删除指定ID的文档
    
    Args:
        doc_id: 文档ID
    
    Returns:
        操作结果
    """
    try:
        # 删除Milvus中的文档
        knowledge_base.delete_document(doc_id)
        
        # 从分组管理中移除文档
        group_manager.remove_document_from_group(doc_id)
        
        return {"success": True, "message": f"成功删除文档: {doc_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除文档失败: {str(e)}")


@router.get("/search")
async def search_knowledge_base(
    query: str = Query(..., description="搜索查询"),
    top_k: int = Query(5, description="返回结果数量", ge=1, le=20)
):
    """搜索知识库
    
    Args:
        query: 搜索查询
        top_k: 返回结果数量
    
    Returns:
        搜索结果列表
    """
    try:
        results = knowledge_base.search(query, top_k)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索知识库失败: {str(e)}")


@router.get("/stats")
async def get_knowledge_base_stats():
    """获取知识库统计信息
    
    Returns:
        知识库统计信息
    """
    try:
        count = knowledge_base.get_document_count()
        return {"success": True, "stats": {"document_count": count}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取知识库统计失败: {str(e)}")


@router.get("/groups")
async def get_knowledge_base_groups():
    """获取所有知识库分组
    
    Returns:
        分组列表
    """
    try:
        groups = group_manager.get_all_groups()
        return {"success": True, "groups": groups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取知识库分组失败: {str(e)}")


@router.post("/groups")
async def add_knowledge_base_group(group_name: str = Query(..., description="分组名称")):
    """添加新的知识库分组
    
    Args:
        group_name: 分组名称
    
    Returns:
        操作结果
    """
    try:
        group_manager.add_group(group_name)
        return {"success": True, "message": f"成功添加分组: {group_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"添加分组失败: {str(e)}")


@router.delete("/groups/{group_name}")
async def delete_knowledge_base_group(group_name: str):
    """删除指定的知识库分组及其所有文档
    
    Args:
        group_name: 分组名称
    
    Returns:
        操作结果
    """
    try:
        # 直接调用分组管理器的delete_group方法
        # delete_group方法已经包含了删除文档和分组的完整逻辑
        success = group_manager.delete_group(group_name)
        if success:
            return {"success": True, "message": f"成功删除分组: {group_name}"}
        else:
            raise HTTPException(status_code=404, detail=f"分组 '{group_name}' 不存在")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除分组失败: {str(e)}")


@router.get("/groups/{group_name}/documents")
async def get_documents_by_group(
    group_name: str
):
    """获取指定分组的文档
    
    Args:
        group_name: 分组名称
    
    Returns:
        文档列表
    """
    try:
        group_info = group_manager.get_group(group_name)
        if not group_info:
            raise HTTPException(status_code=404, detail=f"分组 '{group_name}' 不存在")
        return {"success": True, "documents": group_info.get("documents", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取分组文档失败: {str(e)}")


@router.post("/upload/{group_name}")
async def upload_document_to_group(
    group_name: str,
    file: UploadFile = File(...)
):
    """上传文件到指定分组
    
    Args:
        group_name: 分组名称
        file: 上传的文件
    
    Returns:
        操作结果
    """
    try:
        # 使用FileService根据文件类型解析文件并提取内容
        extracted_text = await FileService.process_uploaded_file(file)
        
        # 生成唯一文档ID - 使用UUID确保唯一性和有效性
        doc_id = f"doc_{str(uuid.uuid4()).replace('-', '_')}"
        
        # 截断摘要以符合Milvus的8192字符限制
        summary = extracted_text[:8192] if len(extracted_text) > 8192 else extracted_text
        
        # 创建文档对象 - 不包含group_name字段
        document = {
            "doc_id": doc_id,
            "section_title": file.filename,
            "summary": summary,
            "title_path": file.filename
        }
        
        # 添加到Milvus知识库
        knowledge_base.add_documents([document])
        
        # 将文档信息添加到分组管理
        group_manager.add_document_to_group(
            group_name=group_name,
            doc_id=doc_id
        )
        
        return {
            "success": True,
            "message": f"成功上传文件 '{file.filename}' 到分组 '{group_name}'",
            "document": document
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")


@router.delete("/clear")
async def clear_knowledge_base():
    """清空知识库
    
    Returns:
        操作结果
    """
    try:
        knowledge_base.clear_all_documents()
        return {"success": True, "message": "成功清空知识库"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清空知识库失败: {str(e)}")
