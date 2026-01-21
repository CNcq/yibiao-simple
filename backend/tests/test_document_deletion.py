#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试文档删除功能的协调性"""

import json
import requests
import time

BASE_URL = "http://localhost:8000/api/knowledge-base"

def test_document_deletion_coordination():
    """测试文档删除的协调性：确保删除文档后，Milvus中的数据也被删除"""
    print("开始测试文档删除的协调性...")
    
    # 1. 获取当前知识库统计信息
    print("\n1. 获取当前知识库统计信息...")
    response = requests.get(f"{BASE_URL}/stats")
    if response.status_code != 200:
        print(f"获取统计信息失败: {response.status_code} - {response.text}")
        return False
    
    initial_count = response.json().get("stats", {}).get("document_count", 0)
    print(f"初始文档数量: {initial_count}")
    
    # 2. 检查knowledge_groups.json中的文档引用
    print("\n2. 检查knowledge_groups.json中的文档引用...")
    groups_file_path = "data/knowledge_groups.json"
    try:
        with open(groups_file_path, "r", encoding="utf-8") as f:
            groups_data = json.load(f)
        
        print("当前分组和文档:")
        for group_name, doc_ids in groups_data.get("group_documents", {}).items():
            print(f"  分组 '{group_name}': {len(doc_ids)} 个文档")
            for doc_id in doc_ids:
                print(f"    - {doc_id}")
        
        # 获取第一个文档ID用于测试
        test_doc_id = None
        for doc_ids in groups_data.get("group_documents", {}).values():
            if doc_ids:
                test_doc_id = doc_ids[0]
                break
        
        if not test_doc_id:
            print("错误: 没有找到可测试的文档")
            return False
        
        print(f"\n选择测试文档ID: {test_doc_id}")
        
    except Exception as e:
        print(f"读取groups文件失败: {str(e)}")
        return False
    
    # 3. 调用删除文档的API
    print("\n3. 调用删除文档的API...")
    response = requests.delete(f"{BASE_URL}/documents", params={"doc_id": test_doc_id})
    if response.status_code != 200:
        print(f"删除文档失败: {response.status_code} - {response.text}")
        return False
    
    print(f"删除文档成功: {response.json().get('message')}")
    
    # 等待一秒，确保操作完成
    time.sleep(1)
    
    # 4. 再次获取知识库统计信息
    print("\n4. 再次获取知识库统计信息...")
    response = requests.get(f"{BASE_URL}/stats")
    if response.status_code != 200:
        print(f"获取统计信息失败: {response.status_code} - {response.text}")
        return False
    
    final_count = response.json().get("stats", {}).get("document_count", 0)
    print(f"删除后的文档数量: {final_count}")
    
    # 5. 再次检查knowledge_groups.json中的文档引用
    print("\n5. 再次检查knowledge_groups.json中的文档引用...")
    try:
        with open(groups_file_path, "r", encoding="utf-8") as f:
            groups_data = json.load(f)
        
        print("删除后的分组和文档:")
        doc_still_exists = False
        for group_name, doc_ids in groups_data.get("group_documents", {}).items():
            print(f"  分组 '{group_name}': {len(doc_ids)} 个文档")
            for doc_id in doc_ids:
                print(f"    - {doc_id}")
                if doc_id == test_doc_id:
                    doc_still_exists = True
        
        if doc_still_exists:
            print("错误: 文档仍然存在于knowledge_groups.json中")
            return False
        else:
            print("文档已从knowledge_groups.json中移除")
            
    except Exception as e:
        print(f"读取groups文件失败: {str(e)}")
        return False
    
    # 6. 验证文档数量是否减少
    if final_count == initial_count - 1:
        print("\n✓ 验证成功: 文档数量正确减少")
    else:
        print(f"\n✗ 验证失败: 文档数量未正确减少 (初始: {initial_count}, 最终: {final_count})")
        return False
    
    print("\n🎉 文档删除的协调性测试通过!")
    print("结论: 删除文档时，Milvus中的数据和knowledge_groups.json中的引用都被正确删除")
    return True

if __name__ == "__main__":
    success = test_document_deletion_coordination()
    exit(0 if success else 1)
