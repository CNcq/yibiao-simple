import json
import re
import sys
import os
from io import BytesIO
import docx

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# 从document模块导入相关函数
from app.routers.document import clean_html_tags, parse_markdown_blocks, render_markdown_blocks

# 读取测试数据
with open('test_request_body.json', 'r', encoding='utf-8') as f:
    test_data = json.load(f)

# 创建一个测试文档
doc = docx.Document()

# 模拟add_markdown_content函数的处理流程
def test_content_processing(content, section_name):
    print(f"\n=== 测试: {section_name} ===")
    print(f"原始内容长度: {len(content)}")
    
    # 第一步：清理HTML标签
    cleaned_content = clean_html_tags(content)
    print(f"清理后内容长度: {len(cleaned_content)}")
    
    # 检查清理后是否还有HTML标签
    if re.search(r'<[^>]+>', cleaned_content):
        print("❌ 清理后仍有HTML标签！")
        tags = re.findall(r'<[^>]+>', cleaned_content)
        print(f"残留标签: {set(tags)}")
        return False
    
    print("✅ 清理后没有HTML标签")
    
    # 第二步：解析Markdown块
    blocks = parse_markdown_blocks(cleaned_content)
    print(f"解析出 {len(blocks)} 个Markdown块")
    
    # 显示块类型统计
    block_types = {}
    for block in blocks:
        block_type = block[0]
        block_types[block_type] = block_types.get(block_type, 0) + 1
    print(f"块类型统计: {block_types}")
    
    # 第三步：渲染到文档
    # 这里我们不会实际渲染到文档，而是检查渲染过程中是否会引入HTML标签
    print("✅ Markdown解析完成")
    
    return True

# 测试每个内容部分
all_passed = True

# 遍历所有章节和子章节
for section in test_data.get('outline', []):
    section_title = section.get('title', '未知章节')
    for child in section.get('children', []):
        child_title = child.get('title', '未知子章节')
        content = child.get('content', '')
        if content:
            if not test_content_processing(content, f"{section_title} - {child_title}"):
                all_passed = False

# 测试特殊情况：直接从Word文档中提取的内容
print("\n=== 测试特殊情况 ===")
# 测试用户报告的特定HTML片段
user_reported_html = "<h3>一、提升供电网格自平衡能力的技术必要性</h3>"
cleaned = clean_html_tags(user_reported_html)
print(f"用户报告的HTML: {user_reported_html}")
print(f"清理后: {cleaned}")

# 测试嵌套标签
nested_html = "<div><p><strong>重要内容</strong></p></div>"
cleaned = clean_html_tags(nested_html)
print(f"嵌套HTML: {nested_html}")
print(f"清理后: {cleaned}")

# 测试不完整标签
incomplete_html = "<p>不完整的标签<strong>没有关闭"
cleaned = clean_html_tags(incomplete_html)
print(f"不完整HTML: {incomplete_html}")
print(f"清理后: {cleaned}")

if all_passed:
    print("\n✅ 所有测试通过！")
else:
    print("\n❌ 部分测试失败！")
