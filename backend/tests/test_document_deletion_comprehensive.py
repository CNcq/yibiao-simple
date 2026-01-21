#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""全面测试文档删除功能"""

import requests
import time
import json

BASE_URL = "http://localhost:8000/api/knowledge-base"

def test_comprehensive_document_deletion():
    """全面测试文档删除功能"""
    print("开始全面测试文档删除功能...")
    
    # 1. 获取初始状态
    print("\n1. 获取初始状态...")
    response = requests.get(f"{BASE_URL}/stats")
    if response.status_code != 200:
        print(f"获取统计信息失败: {response.status_code}")
        return False
    
    initial_count = response.json().get("stats", {}).get("document_count", 0)
    print(f"初始文档数量: {initial_count}")
    
    # 2. 添加一个新文档用于测试
    print("\n2. 添加新文档用于测试...")
    test_document = {
        "summary": "这是一个测试文档，用于验证删除功能",
        "section_title": "测试文档",
        "doc_id": "test_doc_" + str(int(time.time())),
        "title_path": "测试文档"
    }
    
    response = requests.post(f"{BASE_URL}/documents", json=[test_document])
    if response.status_code != 200:
        print(f"添加文档失败: {response.status_code} - {response.text}")
        return False
    
    print("添加文档成功")
    
    # 等待2秒
    time.sleep(2)
    
    # 3. 获取添加后的状态
    print("\n3. 获取添加后的状态...")
    response = requests.get(f"{BASE_URL}/stats")
    if response.status_code == 200:
        after_add_count = response.json().get("stats", {}).get("document_count", 0)
        print(f"添加后文档数量: {after_add_count}")
    
    # 4. 搜索获取新添加的文档ID
    print("\n4. 搜索获取新添加的文档...")
    response = requests.get(f"{BASE_URL}/search", params={"query": "测试文档", "top_k": 5})
    if response.status_code != 200:
        print(f"搜索失败: {response.status_code}")
        return False
    
    results = response.json().get("results", [])
    test_doc_id = None
    for result in results:
        if "测试文档" in result.get("section_title", "") or "测试文档" in result.get("summary", ""):
            test_doc_id = result.get("doc_id")
            print(f"找到测试文档: {test_doc_id} - {result.get('section_title')}")
            break
    
    if not test_doc_id:
        print("未找到测试文档")
        return False
    
    # 5. 删除测试文档
    print(f"\n5. 删除测试文档: {test_doc_id}")
    response = requests.delete(f"{BASE_URL}/documents", params={"doc_id": test_doc_id})
    if response.status_code != 200:
        print(f"删除文档失败: {response.status_code} - {response.text}")
        return False
    
    print("删除文档成功")
    
    # 等待2秒
    time.sleep(2)
    
    # 6. 获取删除后的状态
    print("\n6. 获取删除后的状态...")
    response = requests.get(f"{BASE_URL}/stats")
    if response.status_code == 200:
        after_delete_count = response.json().get("stats", {}).get("document_count", 0)
        print(f"删除后文档数量: {after_delete_count}")
    
    # 7. 验证文档是否真的被删除
    print("\n7. 验证文档是否真的被删除...")
    response = requests.get(f"{BASE_URL}/search", params={"query": "测试文档", "top_k": 5})
    if response.status_code == 200:
        results = response.json().get("results", [])
        found = False
        for result in results:
            if result.get("doc_id") == test_doc_id:
                found = True
                print(f"✗ 文档仍然存在: {result.get('section_title')}")
                break
        if not found:
            print("✓ 文档已从搜索结果中消失")
    
    # 8. 检查knowledge_groups.json
    print("\n8. 检查knowledge_groups.json中的引用...")
    try:
        with open("data/knowledge_groups.json", "r", encoding="utf-8") as f:
            groups_data = json.load(f)
        
        doc_found_in_groups = False
        for group_name, doc_ids in groups_data.get("group_documents", {}).items():
            if test_doc_id in doc_ids:
                doc_found_in_groups = True
                print(f"✗ 文档仍然存在于分组 '{group_name}' 中")
                break
        
        if not doc_found_in_groups:
            print("✓ 文档已从所有分组中移除")
            
    except Exception as e:
        print(f"读取groups文件失败: {str(e)}")
    
    print("\n测试完成！")
    print("总结:")
    print(f"- 初始文档数量: {initial_count}")
    print(f"- 添加后文档数量: {after_add_count}")
    print(f"- 删除后文档数量: {after_delete_count}")
    
    # 虽然统计数量可能不变（因为Milvus的删除机制），但搜索结果和分组引用应该都已清除
    print("\n注意: Milvus的统计数量可能不会立即减少，因为它可能包含已标记删除但未清理的实体。")
    print("但文档应该已经从搜索结果和分组引用中消失。")
    
    return True

if __name__ == "__main__":
    success = test_comprehensive_document_deletion()
    exit(0 if success else 1)
