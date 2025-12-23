#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试文件上传接口"""

import requests
import os

# API 配置
API_BASE_URL = "http://127.0.0.1:8000/api/knowledge-base"
TEST_GROUP_NAME = "test_group"

# 确保测试分组存在
def create_test_group():
    """创建测试分组"""
    try:
        response = requests.post(f"{API_BASE_URL}/groups?group_name={TEST_GROUP_NAME}")
        if response.status_code == 200:
            print(f"✅ 成功创建测试分组: {TEST_GROUP_NAME}")
        elif response.status_code == 500:
            # 分组可能已存在，忽略错误
            print(f"⚠️  测试分组可能已存在: {TEST_GROUP_NAME}")
        else:
            print(f"❌ 创建测试分组失败: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ 创建测试分组失败: {e}")

# 测试上传Word文件
def test_upload_word_file():
    """测试上传Word文件"""
    try:
        # 创建一个简单的Word文件用于测试
        with open("test_word.docx", "w") as f:
            f.write("Test Word file content")
        
        # 上传文件
        with open("test_word.docx", "rb") as f:
            files = {"file": ("test_word.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
            response = requests.post(f"{API_BASE_URL}/upload/{TEST_GROUP_NAME}", files=files)
        
        if response.status_code == 200:
            print("✅ Word文件上传成功！")
            print(f"📄 响应: {response.json()}")
        else:
            print(f"❌ Word文件上传失败: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Word文件上传失败: {e}")
    finally:
        # 清理测试文件
        if os.path.exists("test_word.docx"):
            os.remove("test_word.docx")

# 测试上传PDF文件
def test_upload_pdf_file():
    """测试上传PDF文件"""
    try:
        # 创建一个简单的PDF文件用于测试
        with open("test_pdf.pdf", "w") as f:
            f.write("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF file) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000098 00000 n \n0000000166 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n242\n%%EOF")
        
        # 上传文件
        with open("test_pdf.pdf", "rb") as f:
            files = {"file": ("test_pdf.pdf", f, "application/pdf")}
            response = requests.post(f"{API_BASE_URL}/upload/{TEST_GROUP_NAME}", files=files)
        
        if response.status_code == 200:
            print("✅ PDF文件上传成功！")
            print(f"📄 响应: {response.json()}")
        else:
            print(f"❌ PDF文件上传失败: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ PDF文件上传失败: {e}")
    finally:
        # 清理测试文件
        if os.path.exists("test_pdf.pdf"):
            os.remove("test_pdf.pdf")

# 测试上传大文件（超过8192字符）
def test_upload_large_file():
    """测试上传大文件，确保摘要长度限制仍然生效"""
    try:
        # 创建一个大文本文件用于测试
        large_content = "Test content " * 2000  # 大约8000字符
        with open("test_large.txt", "w") as f:
            f.write(large_content)
        
        # 上传文件
        with open("test_large.txt", "rb") as f:
            files = {"file": ("test_large.txt", f, "text/plain")}
            response = requests.post(f"{API_BASE_URL}/upload/{TEST_GROUP_NAME}", files=files)
        
        if response.status_code == 200:
            print("✅ 大文件上传成功！")
            document = response.json().get("document", {})
            summary = document.get("summary", "")
            print(f"📏 摘要长度: {len(summary)}")
            if len(summary) <= 8192:
                print("✅ 摘要长度限制仍然生效！")
            else:
                print("❌ 摘要长度超过限制！")
        else:
            print(f"❌ 大文件上传失败: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ 大文件上传失败: {e}")
    finally:
        # 清理测试文件
        if os.path.exists("test_large.txt"):
            os.remove("test_large.txt")

# 测试搜索功能
def test_search():
    """测试搜索功能，验证文件是否正确保存到Milvus"""
    try:
        response = requests.get(f"{API_BASE_URL}/search?query=test&top_k=5")
        if response.status_code == 200:
            results = response.json().get("results", [])
            print(f"✅ 搜索成功，找到 {len(results)} 个结果")
            if results:
                print("📄 搜索结果示例:")
                for i, result in enumerate(results[:2]):
                    print(f"   {i+1}. {result.get('section_title', 'N/A')} - 相似度: {result.get('similarity', 0):.2f}")
        else:
            print(f"❌ 搜索失败: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ 搜索失败: {e}")

# 清理测试数据
def clean_test_data():
    """清理测试数据"""
    try:
        # 获取分组下的所有文档
        response = requests.get(f"{API_BASE_URL}/groups/{TEST_GROUP_NAME}/documents")
        if response.status_code == 200:
            documents = response.json().get("documents", [])
            for doc in documents:
                doc_id = doc.get("doc_id")
                if doc_id:
                    # 删除文档
                    requests.delete(f"{API_BASE_URL}/documents/{doc_id}")
                    print(f"🗑️  删除测试文档: {doc_id}")
        
        # 删除测试分组
        requests.delete(f"{API_BASE_URL}/groups/{TEST_GROUP_NAME}")
        print(f"🗑️  删除测试分组: {TEST_GROUP_NAME}")
    except Exception as e:
        print(f"❌ 清理测试数据失败: {e}")

if __name__ == "__main__":
    print("🚀 开始测试文件上传接口...")
    
    # 创建测试分组
    create_test_group()
    
    # 测试上传Word文件
    print("\n📝 测试上传Word文件...")
    test_upload_word_file()
    
    # 测试上传PDF文件
    print("\n📄 测试上传PDF文件...")
    test_upload_pdf_file()
    
    # 测试上传大文件
    print("\n📁 测试上传大文件...")
    test_upload_large_file()
    
    # 测试搜索功能
    print("\n🔍 测试搜索功能...")
    test_search()
    
    # 清理测试数据
    print("\n🗑️  清理测试数据...")
    clean_test_data()
    
    print("\n🎉 所有测试完成！")
