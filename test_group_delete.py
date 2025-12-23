#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试分组删除功能是否正常工作
"""

import requests
import json
import time

# API基础URL
API_BASE_URL = "http://localhost:8000"

def test_group_delete():
    """测试分组删除功能"""
    print("=== 测试分组删除功能 ===")
    
    # 1. 获取当前所有分组
    print("\n1. 获取当前所有分组：")
    groups_url = f"{API_BASE_URL}/api/knowledge-base/groups"
    try:
        response = requests.get(groups_url)
        response.raise_for_status()
        groups = response.json()['groups']
        print(f"当前分组列表：{[group['name'] for group in groups]}")
        
        if not groups:
            print("没有可用分组，创建一个测试分组...")
            # 创建一个测试分组
            create_group_url = f"{API_BASE_URL}/api/knowledge-base/groups"
            test_group_name = "测试分组"
            
            # 先检查测试分组是否已存在
            existing_group_names = [group['name'] for group in groups]
            if test_group_name not in existing_group_names:
                response = requests.post(create_group_url, params={"group_name": test_group_name})
                response.raise_for_status()
                print(f"创建测试分组 '{test_group_name}' 成功")
                
                # 重新获取分组列表
                response = requests.get(groups_url)
                response.raise_for_status()
                groups = response.json()['groups']
                print(f"更新后的分组列表：{[group['name'] for group in groups]}")
        
        # 2. 选择一个分组进行删除测试
        if groups:
            # 选择第一个非"默认"分组（如果有的话）
            group_to_delete = None
            for group in groups:
                if group['name'] != "默认":
                    group_to_delete = group
                    break
            
            # 如果没有找到非"默认"分组，就使用第一个分组
            if not group_to_delete:
                group_to_delete = groups[0]
            
            print(f"\n2. 选择删除分组：{group_to_delete['name']}")
            
            # 3. 删除分组
            delete_url = f"{API_BASE_URL}/api/knowledge-base/groups/{group_to_delete['name']}"
            response = requests.delete(delete_url)
            response.raise_for_status()
            print(f"删除分组 '{group_to_delete['name']}' 成功")
            
            # 4. 验证分组是否被删除
            print("\n3. 验证分组是否被删除：")
            response = requests.get(groups_url)
            response.raise_for_status()
            updated_groups = response.json()['groups']
            updated_group_names = [group['name'] for group in updated_groups]
            
            if group_to_delete['name'] not in updated_group_names:
                print(f"✓ 分组 '{group_to_delete['name']}' 已成功从分组列表中删除")
                print(f"更新后的分组列表：{updated_group_names}")
                print("\n=== 测试通过！分组删除功能正常工作 ===")
                return True
            else:
                print(f"✗ 分组 '{group_to_delete['name']}' 仍然在分组列表中")
                print(f"当前分组列表：{updated_group_names}")
                print("\n=== 测试失败！分组删除功能存在问题 ===")
                return False
        else:
            print("没有分组可用于测试删除功能")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"API请求失败：{e}")
        return False
    except json.JSONDecodeError as e:
        print(f"JSON解析失败：{e}")
        return False
    except KeyError as e:
        print(f"响应数据缺少必要字段：{e}")
        return False

if __name__ == "__main__":
    test_group_delete()