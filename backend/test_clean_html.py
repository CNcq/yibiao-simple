import sys
import os
import re
import json

# 将项目根目录添加到Python路径
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 导入要测试的函数
from backend.app.routers.document import clean_html_tags

def test_clean_html_tags():
    """测试clean_html_tags函数是否能完全清除HTML标签"""
    # 读取测试请求体
    with open('test_request_body.json', 'r', encoding='utf-8') as f:
        test_data = json.load(f)
    
    print("=== 测试clean_html_tags函数 ===")
    
    # 测试项目概述
    print("\n1. 测试项目概述:")
    overview = test_data.get('project_overview', '')
    if overview:
        cleaned = clean_html_tags(overview)
        residual_tags = re.findall(r'<[^>]+>', cleaned)
        if residual_tags:
            print(f"   ❌ 发现残留HTML标签: {residual_tags}")
        else:
            print("   ✅ 无残留HTML标签")
    else:
        print("   ⚠️ 项目概述为空")
    
    # 测试目录内容
    print("\n2. 测试目录内容:")
    outline = test_data.get('outline', [])
    all_clean = True
    
    def test_outline_item(item, level=1):
        nonlocal all_clean
        indent = "  " * (level - 1)
        
        # 测试标题
        title = item.get('title', '')
        cleaned_title = clean_html_tags(title)
        residual_tags_title = re.findall(r'<[^>]+>', cleaned_title)
        if residual_tags_title:
            print(f"{indent}❌ 标题 '{title}' 发现残留HTML标签: {residual_tags_title}")
            all_clean = False
        
        # 测试描述
        description = item.get('description', '')
        cleaned_desc = clean_html_tags(description)
        residual_tags_desc = re.findall(r'<[^>]+>', cleaned_desc)
        if residual_tags_desc:
            print(f"{indent}❌ 描述 '{description}' 发现残留HTML标签: {residual_tags_desc}")
            all_clean = False
        
        # 测试内容
        content = item.get('content', '')
        if content:
            cleaned_content = clean_html_tags(content)
            residual_tags_content = re.findall(r'<[^>]+>', cleaned_content)
            if residual_tags_content:
                print(f"{indent}❌ 内容中发现残留HTML标签: {residual_tags_content}")
                # 显示残留标签的上下文
                for tag in set(residual_tags_content):
                    matches = re.finditer(f'({tag})', cleaned_content)
                    for match in matches:
                        start = max(0, match.start() - 50)
                        end = min(len(cleaned_content), match.end() + 50)
                        context = cleaned_content[start:end]
                        print(f"{indent}   上下文: ...{context}...")
                all_clean = False
            else:
                print(f"{indent}✅ 内容无残留HTML标签")
        
        # 测试子项
        children = item.get('children', [])
        for child in children:
            test_outline_item(child, level + 1)
    
    for item in outline:
        test_outline_item(item)
    
    if all_clean:
        print("\n🎉 所有测试通过！clean_html_tags函数能完全清除HTML标签")
        return True
    else:
        print("\n❌ 测试失败！发现残留HTML标签")
        return False

if __name__ == "__main__":
    test_clean_html_tags()