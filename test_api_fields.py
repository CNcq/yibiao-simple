import requests

# 测试获取分组文档API是否只返回必要字段（不包含摘要）
base_url = "http://localhost:8000"
group_name = "未分类"

def main():
    try:
        # 获取指定分组的文档
        response = requests.get(f"{base_url}/api/knowledge-base/groups/{group_name}/documents")
        response.raise_for_status()
        result = response.json()
        
        print("API响应状态:", result.get('success'))
        documents = result.get('documents', [])
        print("获取到文档数:", len(documents))
        
        for i, doc in enumerate(documents):
            print(f"\n文档 {i+1} 字段:", list(doc.keys()))
            print("  文件名:", doc.get('section_title') or doc.get('title_path'))
            print("  是否包含摘要:", "是" if "summary" in doc else "否")
        
    except Exception as e:
        print("测试失败:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()