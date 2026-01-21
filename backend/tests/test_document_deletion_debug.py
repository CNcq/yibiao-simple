#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""调试文档删除功能"""

import requests
import time

BASE_URL = "http://localhost:8000/api/knowledge-base"

def test_delete_document_debug():
    """调试文档删除功能"""
    print("开始调试文档删除功能...")
    
    # 测试文档ID
    test_doc_id = "doc_8de119fa_031d_47b6_aca7_a7772292f5e9"
    print(f"测试文档ID: {test_doc_id}")
    
    # 1. 尝试直接删除文档
    print("\n1. 调用删除文档API...")
    response = requests.delete(f"{BASE_URL}/documents", params={"doc_id": test_doc_id})
    print(f"响应状态码: {response.status_code}")
    print(f"响应内容: {response.json()}")
    
    # 等待2秒
    time.sleep(2)
    
    # 2. 再次获取统计信息
    print("\n2. 获取知识库统计信息...")
    response = requests.get(f"{BASE_URL}/stats")
    if response.status_code == 200:
        count = response.json().get("stats", {}).get("document_count", 0)
        print(f"当前文档数量: {count}")
    
    # 3. 检查是否还能通过ID获取文档
    print("\n3. 检查文档是否还存在...")
    # 这里我们可以通过搜索API尝试查找该文档
    response = requests.get(f"{BASE_URL}/search", params={"query": "test", "top_k": 10})
    if response.status_code == 200:
        results = response.json().get("results", [])
        print(f"搜索结果数量: {len(results)}")
        found = False
        for result in results:
            if result.get("doc_id") == test_doc_id:
                found = True
                print(f"✗ 文档仍然存在于搜索结果中: {result.get('section_title')}")
                break
        if not found:
            print("✓ 文档不在搜索结果中")
    
    print("\n调试完成")

if __name__ == "__main__":
    test_delete_document_debug()
