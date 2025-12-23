import requests

# 测试获取分组文档API是否只返回必要字段（不包含摘要）
base_url = "http://localhost:8000"
group_name = "未分类"

def test_document_fields_api():
    """测试文档信息API是否只返回必要字段（不包含摘要）"""
    try:
        # 获取指定分组的文档
        response = requests.get(f"{base_url}/api/knowledge-base/groups/{group_name}/documents")
        response.raise_for_status()
        result = response.json()
        
        print(f"API响应状态: {result.get('success')}")
        documents = result.get('documents', [])
        print(f"获取到{len(documents)}个文档")
        
        if not documents:
            print("\n⚠️  当前分组中没有文档，请先上传一个PDF或Word文件")
            return False
        
        # 检查每个文档的字段
        for i, doc in enumerate(documents):
            print(f"\n文档 {i+1}:")
            print(f"  包含的字段: {list(doc.keys())}")
            
            # 检查是否包含必要字段
            has_necessary_fields = all(field in doc for field in ['doc_id', 'section_title', 'title_path'])
            
            # 检查是否不包含摘要字段
            has_no_summary = 'summary' not in doc
            
            if has_necessary_fields and has_no_summary:
                print(f"  ✅ 正确：只包含必要字段，不包含摘要")
                print(f"  文件名: {doc.get('section_title') or doc.get('title_path')}")
            else:
                print(f"  ❌ 错误：")
                if not has_necessary_fields:
                    print(f"    - 缺少必要字段")
                if not has_no_summary:
                    print(f"    - 不应该包含摘要字段")
        
        return True
            
    except Exception as e:
        print(f"测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_document_fields_api()