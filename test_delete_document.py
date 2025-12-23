import requests
import json

API_BASE_URL = "http://localhost:8000/api/knowledge-base"

def test_delete_document():
    """测试删除文档API"""
    try:
        # 首先获取所有文档
        response = requests.get(f"{API_BASE_URL}/groups/未分类/documents")
        if response.status_code == 200:
            documents = response.json().get("documents", [])
            if documents:
                # 获取第一个文档的ID
                doc_id = documents[0].get("doc_id")
                if doc_id:
                    print(f"要删除的文档ID: {doc_id}")
                    
                    # 测试删除文档
                    delete_response = requests.delete(f"{API_BASE_URL}/documents/{doc_id}")
                    print(f"删除请求状态码: {delete_response.status_code}")
                    print(f"删除请求响应: {delete_response.text}")
                    
                    if delete_response.status_code == 200:
                        print("✅ 删除文档成功")
                    else:
                        print("❌ 删除文档失败")
                else:
                    print("❌ 文档没有doc_id字段")
            else:
                print("❌ 未找到任何文档")
        else:
            print(f"❌ 获取文档失败，状态码: {response.status_code}")
            print(f"响应内容: {response.text}")
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {str(e)}")

if __name__ == "__main__":
    test_delete_document()