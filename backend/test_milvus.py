#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Milvus 连接测试脚本"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_milvus_connection():
    """测试Milvus连接和基本功能"""
    print("=== Milvus Standalone 连接测试 ===")
    
    try:
        # 导入Milvus服务
        from app.services.milvus_service import knowledge_base
        
        print("✓ 成功导入Milvus服务")
        
        # 测试文档添加
        test_docs = [
            {
                "content": "这是一个测试文档，用于验证Milvus连接功能。",
                "title": "测试文档1",
                "metadata": {"source": "test", "type": "document"}
            },
            {
                "content": "Milvus是一个开源的向量数据库，用于高效存储和检索向量数据。",
                "title": "Milvus简介",
                "metadata": {"source": "test", "type": "introduction"}
            }
        ]
        
        knowledge_base.add_documents(test_docs)
        print("✓ 成功添加测试文档")
        
        # 测试文档数量
        doc_count = knowledge_base.get_document_count()
        print(f"✓ 当前知识库文档数量: {doc_count}")
        
        # 测试搜索功能
        query = "Milvus是什么？"
        results = knowledge_base.search(query, top_k=2)
        print(f"✓ 搜索 '{query}' 得到 {len(results)} 个结果")
        
        if results:
            print("  搜索结果详情:")
            for i, result in enumerate(results, 1):
                print(f"  {i}. 标题: {result['title']}")
                print(f"     匹配度: {result['score']:.4f}")
                print(f"     内容: {result['content'][:50]}...")
        
        print("\n=== 测试完成，所有功能正常工作！===\n")
        return True
        
    except Exception as e:
        print(f"✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_config():
    """测试配置加载"""
    print("=== 配置测试 ===")
    
    try:
        from app.config import settings
        
        print(f"✓ Milvus 启用状态: {settings.enable_milvus}")
        print(f"✓ Milvus URI: {settings.milvus_uri}")
        print(f"✓ Milvus 集合名称: {settings.milvus_collection_name}")
        print(f"✓ Milvus 索引类型: {settings.milvus_index_type}")
        print(f"✓ Milvus 索引参数: {settings.milvus_index_params}")
        print(f"✓ Milvus 搜索参数: {settings.milvus_search_params}")
        
        return True
        
    except Exception as e:
        print(f"✗ 配置测试失败: {e}")
        return False

if __name__ == "__main__":
    # 测试配置
    config_ok = test_config()
    
    # 测试Milvus连接
    if config_ok:
        milvus_ok = test_milvus_connection()
    else:
        milvus_ok = False
    
    # 输出测试结果
    if config_ok and milvus_ok:
        print("🎉 所有测试通过！Milvus Standalone 已成功配置并连接。")
        sys.exit(0)
    else:
        print("❌ 测试失败，请检查配置和Milvus服务状态。")
        sys.exit(1)