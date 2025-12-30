import json
import re
import sys
import os
from io import BytesIO
from fastapi.testclient import TestClient
from app.main import app

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# 创建测试客户端
client = TestClient(app)

# 读取测试数据
with open('test_request_body.json', 'r', encoding='utf-8') as f:
    test_data = json.load(f)

# 定义一个函数来检查字符串中是否存在HTML标签
def has_html_tags(text):
    return bool(re.search(r'<[^>]+>', text))

# 发送实际的导出请求
def test_actual_export():
    print("=== 测试实际Word导出流程 ===")
    print("=" * 50)
    
    # 发送POST请求到export-word接口
    response = client.post("/api/document/export-word", json=test_data)
    
    if response.status_code != 200:
        print(f"❌ 请求失败: {response.status_code}")
        print(f"错误信息: {response.text}")
        return False
    
    print("✅ 请求成功")
    print(f"响应内容类型: {response.headers.get('content-type')}")
    print(f"响应内容长度: {len(response.content)} bytes")
    
    # 保存导出的Word文档以便检查
    output_filename = "test_export_result.docx"
    with open(output_filename, 'wb') as f:
        f.write(response.content)
    
    print(f"✅ 导出的Word文档已保存为: {output_filename}")
    
    # 现在检查导出前的数据处理过程
    print("\n=== 检查数据处理过程 ===")
    
    # 从document模块导入clean_html_tags函数
    from app.routers.document import clean_html_tags
    
    all_passed = True
    
    # 检查项目名称
    project_name = test_data.get('project_name', '')
    if project_name and has_html_tags(project_name):
        print("❌ 项目名称包含HTML标签")
        all_passed = False
    
    # 检查项目概述
    project_overview = test_data.get('project_overview', '')
    if project_overview:
        cleaned_overview = clean_html_tags(project_overview)
        if has_html_tags(cleaned_overview):
            print("❌ 项目概述清理后仍有HTML标签")
            all_passed = False
    
    # 检查所有章节内容
    for section in test_data.get('outline', []):
        section_title = section.get('title', '未知章节')
        if has_html_tags(section_title):
            print(f"❌ 章节标题 '{section_title}' 包含HTML标签")
            all_passed = False
        
        for child in section.get('children', []):
            child_title = child.get('title', '未知子章节')
            if has_html_tags(child_title):
                print(f"❌ 子章节标题 '{child_title}' 包含HTML标签")
                all_passed = False
            
            content = child.get('content', '')
            if content:
                cleaned_content = clean_html_tags(content)
                if has_html_tags(cleaned_content):
                    print(f"❌ 内容 '{section_title} - {child_title}' 清理后仍有HTML标签")
                    all_passed = False
                    
                    # 显示残留标签
                    tags = re.findall(r'<[^>]+>', cleaned_content)
                    print(f"残留标签: {set(tags)}")
    
    if all_passed:
        print("\n✅ 所有内容在导出前都已正确清理HTML标签")
        print("\n建议: 请手动检查导出的Word文档，确认是否真的存在HTML标签。如果仍然存在，可能是在Markdown渲染过程中引入的。")
    else:
        print("\n❌ 部分内容清理后仍有HTML标签")
    
    return all_passed

if __name__ == "__main__":
    test_actual_export()
