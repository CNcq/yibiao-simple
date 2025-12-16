#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""知识库管理API路由"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any

from ..services.milvus_service import knowledge_base

router = APIRouter(prefix="/api/knowledge-base", tags=["知识库管理"])


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


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: int):
    """删除指定ID的文档
    
    Args:
        doc_id: 文档ID
    
    Returns:
        操作结果
    """
    try:
        knowledge_base.delete_document(doc_id)
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
