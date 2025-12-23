import requests
import json
import os
import time

# 测试获取分组文档API是否返回文件名
base_url = "http://localhost:8000"
group_name = "未分类"

def test_document_info():
    """测试文档信息是否包含文件名"""
    try:
        # 1. 先上传一个测试文档
        print("=== 上传测试文档 ===")
        
        # 创建一个简单的文本文件
        test_content = "这是一个测试文档，用于验证文件名显示功能"
        with open("test_document.txt", "w", encoding="utf-8") as f:
            f.write(test_content)
        
        # 上传文件
        files = {"file": ("test_document.txt", open("test_document.txt", "rb"), "text/plain")}
        response = requests.post(f"{base_url}/api/knowledge-base/upload/{group_name}", files=files)
        response.raise_for_status()
        upload_result = response.json()
        print(f"上传结果: {upload_result.get('message')}")
        
        # 删除临时文件
        os.remove("test_document.txt")
        
        # 等待一下，确保数据已写入
        time.sleep(1)
        
        # 2. 获取指定分组的文档
        print("\n=== 获取分组文档信息 ===")
        response = requests.get(f"{base_url}/api/knowledge-base/groups/{group_name}/documents")
        response.raise_for_status()
        result = response.json()
        
        print(f"API响应状态: {result.get('success')}")
        documents = result.get('documents', [])
        print(f"获取到{len(documents)}个文档")
        
        for i, doc in enumerate(documents):
            print(f"\n文档 {i+1}:")
            print(f"  doc_id: {doc.get('doc_id')}")
            print(f"  section_title: {doc.get('section_title')}")
            print(f"  title_path: {doc.get('title_path')}")
            print(f"  summary: {doc.get('summary', '').strip()[:100]}...")
            
            # 检查是否包含文件名信息
            if doc.get('section_title') or doc.get('title_path'):
                print("  ✅ 包含文件名信息")
            else:
                print("  ❌ 缺少文件名信息")
        
        return True
        
    except Exception as e:
        print(f"测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_document_info()