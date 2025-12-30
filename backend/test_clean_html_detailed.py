import json
import re
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# 从document模块导入clean_html_tags函数
from app.routers.document import clean_html_tags

# 读取测试数据
with open('test_request_body.json', 'r', encoding='utf-8') as f:
    test_data = json.load(f)

# 定义一个函数来检查字符串中是否存在HTML标签
def has_html_tags(text):
    return bool(re.search(r'<[^>]+>', text))

# 收集所有内容进行测试
test_cases = []

# 项目概述
test_cases.append(('项目概述', test_data.get('project_overview', '')))

# 正文内容
for section in test_data.get('outline', []):
    section_title = section.get('title', '未知章节')
    for child in section.get('children', []):
        child_title = child.get('title', '未知子章节')
        content = child.get('content', '')
        if content:
            test_cases.append((f'{section_title} - {child_title}', content))

# 执行测试
print("=== 详细HTML标签清理测试 ===")
print("=" * 50)

all_passed = True
for case_name, raw_content in test_cases:
    if not raw_content:
        print(f"{case_name}: 无内容，跳过测试")
        continue
    
    print(f"\n测试: {case_name}")
    print(f"原始内容长度: {len(raw_content)}")
    
    # 执行清理
    cleaned_content = clean_html_tags(raw_content)
    
    print(f"清理后内容长度: {len(cleaned_content)}")
    
    # 检查是否还有HTML标签
    if has_html_tags(cleaned_content):
        print("❌ 清理后仍然存在HTML标签！")
        all_passed = False
        
        # 找出所有残留的HTML标签
        tags = re.findall(r'<[^>]+>', cleaned_content)
        unique_tags = set(tags)
        print(f"残留标签: {unique_tags}")
        
        # 显示包含标签的上下文
        for tag in unique_tags:
            # 找到标签出现的位置
            tag_pos = cleaned_content.find(tag)
            if tag_pos != -1:
                # 显示标签前后50个字符的上下文
                start = max(0, tag_pos - 50)
                end = min(len(cleaned_content), tag_pos + len(tag) + 50)
                context = cleaned_content[start:end]
                print(f"\n标签 '{tag}' 的上下文:")
                print(f"...{context}...")
                
                # 尝试在原始内容中找到对应的部分
                raw_tag_pos = raw_content.find(tag)
                if raw_tag_pos != -1:
                    raw_start = max(0, raw_tag_pos - 50)
                    raw_end = min(len(raw_content), raw_tag_pos + len(tag) + 50)
                    raw_context = raw_content[raw_start:raw_end]
                    print(f"原始内容中的上下文:")
                    print(f"...{raw_context}...")
    else:
        print("✅ 清理后没有HTML标签")
        
    # 显示清理前后的内容示例
    print(f"\n原始内容示例 (前200字符):")
    print(f"{raw_content[:200]}...")
    print(f"\n清理后内容示例 (前200字符):")
    print(f"{cleaned_content[:200]}...")

print("\n" + "=" * 50)
if all_passed:
    print("✅ 所有测试通过！")
else:
    print("❌ 部分测试失败，仍有HTML标签残留！")
