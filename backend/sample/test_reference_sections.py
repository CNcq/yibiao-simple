#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试参考章节获取功能"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_get_reference_sections():
    """测试获取参考章节功能"""
    print("=== 参考章节获取功能测试 ===")
    
    try:
        # 导入Milvus服务和工具
        from app.services.milvus_service import knowledge_base
        from pymilvus import utility
        from app.config import settings
        
        print("✓ 成功导入Milvus服务")
        
        # 确保集合存在
        if not utility.has_collection(settings.milvus_collection_name):
            knowledge_base.create_collection()
            print("✓ 创建了新集合")
        
        # 先添加测试数据
        test_docs = [
            {
                "doc_id": "test_doc_001",
                "section_title": "测试文档1",
                "summary": "这是一个测试文档，用于验证Milvus连接功能。",
                "title_path": "测试 > 测试文档1"
            },
            {
                "doc_id": "test_doc_002",
                "section_title": "Milvus简介",
                "summary": "Milvus是一个开源的向量数据库，用于高效存储和检索向量数据。",
                "title_path": "测试 > Milvus简介"
            }
        ]
        
        knowledge_base.add_documents(test_docs)
        print("✓ 成功添加测试文档")
        
        # 测试获取参考章节
        section_title = "Milvus简介"
        section_content = "这是一个关于Milvus的介绍章节，需要参考知识库中的相关内容。"
        
        reference_sections = knowledge_base.get_reference_sections(section_title, section_content, top_k=2)
        print(f"✓ 为章节 '{section_title}' 找到 {len(reference_sections)} 个参考章节")
        
        if reference_sections:
            print("  参考章节详情:")
            for i, section in enumerate(reference_sections, 1):
                print(f"  {i}. 文档ID: {section['doc_id']}")
                print(f"     章节标题: {section['section_title']}")
                print(f"     章节层级: {section['title_path']}")
                print(f"     匹配度: {section['score']:.4f}")
                print(f"     内容摘要: {section['summary'][:50]}...")
        
        print("\n=== 测试完成，参考章节获取功能正常工作！===\n")
        return True
        
    except Exception as e:
        print(f"✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # 测试获取参考章节功能
    success = test_get_reference_sections()
    
    if success:
        print("🎉 所有测试通过！参考章节获取功能已成功实现。")
        sys.exit(0)
    else:
        print("❌ 测试失败，请检查代码和Milvus服务状态。")
        sys.exit(1)
