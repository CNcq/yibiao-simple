#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试删除单个文档"""

from app.services.milvus_service import knowledge_base

def test_delete_single_document():
    """测试删除单个文档"""
    print("=== 测试删除单个文档 ===")
    
    # 测试文档ID（从knowledge_groups.json中获取一个）
    test_doc_id = "doc_794090c1_2c36_4310_bb85_0865591f6679"
    
    try:
        # 直接调用delete_document方法
        print(f"删除文档: {test_doc_id}")
        knowledge_base.delete_document(test_doc_id)
        print("✅ 文档删除成功")
    except Exception as e:
        print(f"❌ 文档删除失败: {e}")

if __name__ == "__main__":
    test_delete_single_document()