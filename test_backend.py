#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试后端API"""

import requests
import json

# 测试分组列表API
def test_groups_api():
    url = "http://localhost:8000/api/knowledge-base/groups"
    response = requests.get(url)
    print("分组列表API响应:")
    print(f"状态码: {response.status_code}")
    print(f"响应内容: {response.text}")
    
    # 解析JSON响应
    data = response.json()
    print(f"\n解析后的JSON:")
    print(json.dumps(data, indent=2, ensure_ascii=False))

# 测试分组文档API
def test_group_documents_api():
    url = "http://localhost:8000/api/knowledge-base/groups/%E6%B5%8B%E8%AF%95%E6%96%87%E6%A1%A3/documents"
    response = requests.get(url)
    print("\n\n分组文档API响应:")
    print(f"状态码: {response.status_code}")
    print(f"响应内容: {response.text}")
    
    # 解析JSON响应
    data = response.json()
    print(f"\n解析后的JSON:")
    print(json.dumps(data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    test_groups_api()
    test_group_documents_api()