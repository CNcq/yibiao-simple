#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试修改后的文档删除API
"""

import requests
import json

# API基本URL
API_BASE_URL = "http://localhost:8000"

# 要删除的文档ID
# 注意：需要替换为实际存在的文档ID
doc_id_to_delete = "未分类_测试.docx_application/vnd.openxmlformats-officedocument.wordprocessingml.document"

def test_delete_document():
    """测试删除文档API"""
    try:
        # 使用查询参数传递doc_id
        url = f"{API_BASE_URL}/api/knowledge-base/documents"
        params = {"doc_id": doc_id_to_delete}
        
        response = requests.delete(url, params=params)
        
        print(f"请求URL: {response.url}")
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        
        if response.status_code == 200:
            print("\n✅ 删除文档成功！")
            return True
        else:
            print(f"\n❌ 删除文档失败，状态码: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"\n❌ 请求发生异常: {str(e)}")
        return False

def test_get_documents_by_group():
    """获取分组文档，检查删除是否成功"""
    try:
        # 获取"未分类"分组的文档
        url = f"{API_BASE_URL}/api/knowledge-base/groups/未分类/documents"
        
        response = requests.get(url)
        
        print(f"\n获取分组文档 - 响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                documents = data.get("documents", [])
                print(f"获取到 {len(documents)} 个文档")
                for doc in documents:
                    print(f"  - {doc.get('doc_id')}")
                return documents
            else:
                print(f"获取分组文档失败: {data.get('detail')}")
                return []
        else:
            print(f"获取分组文档失败，状态码: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"\n❌ 请求发生异常: {str(e)}")
        return []

if __name__ == "__main__":
    print("=== 测试修改后的文档删除API ===")
    
    # 测试删除文档
    delete_success = test_delete_document()
    
    if delete_success:
        # 验证删除结果
        documents = test_get_documents_by_group()
        
        # 检查被删除的文档是否还存在
        deleted_doc_found = any(doc.get('doc_id') == doc_id_to_delete for doc in documents)
        if not deleted_doc_found:
            print(f"\n✅ 验证成功：文档 '{doc_id_to_delete}' 已被成功删除")
        else:
            print(f"\n❌ 验证失败：文档 '{doc_id_to_delete}' 仍然存在")
    else:
        print("\n❌ 删除测试失败，不进行验证")
