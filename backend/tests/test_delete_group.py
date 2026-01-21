#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试分组删除功能"""

import requests
import os

BASE_URL = "http://localhost:8000/api/knowledge-base"
TEST_GROUP_NAME = "测试分组"

def test_delete_group():
    """测试删除分组功能"""
    print("=== 测试删除分组功能 ===")
    
    # 1. 获取当前分组信息
    print("\n1. 获取当前分组信息")
    groups_url = f"{BASE_URL}/groups"
    response = requests.get(groups_url)
    if response.status_code == 200:
        groups = response.json().get("groups", [])
        print(f"当前分组数量: {len(groups)}")
        for group in groups:
            print(f"  - {group['name']}: {group.get('document_count', 0)} 个文档")
    else:
        print(f"获取分组失败: {response.json()}")
        return
    
    # 2. 测试删除分组
    print(f"\n2. 测试删除分组 '{TEST_GROUP_NAME}'")
    delete_url = f"{BASE_URL}/groups/{TEST_GROUP_NAME}"
    response = requests.delete(delete_url)
    if response.status_code == 200:
        print(f"✅ 分组 '{TEST_GROUP_NAME}' 删除成功")
    else:
        print(f"❌ 删除分组失败: {response.json()}")
        return
    
    # 3. 验证分组已删除
    print("\n3. 验证分组已删除")
    response = requests.get(groups_url)
    if response.status_code == 200:
        groups = response.json().get("groups", [])
        print(f"删除后分组数量: {len(groups)}")
        for group in groups:
            print(f"  - {group['name']}: {group.get('document_count', 0)} 个文档")
        
        # 检查测试分组是否存在
        test_group_exists = any(group['name'] == TEST_GROUP_NAME for group in groups)
        if not test_group_exists:
            print(f"✅ 分组 '{TEST_GROUP_NAME}' 已成功删除")
        else:
            print(f"❌ 分组 '{TEST_GROUP_NAME}' 仍然存在")
    else:
        print(f"获取分组失败: {response.json()}")

if __name__ == "__main__":
    test_delete_group()