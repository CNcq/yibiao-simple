import requests

# 测试获取分组文档API是否返回文件名
base_url = "http://localhost:8000"
group_name = "未分类"

def test_document_info_api():
    """测试文档信息API是否返回包含文件名的文档"""
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
        
        # 检查每个文档是否包含文件名信息
        all_have_filename = True
        for i, doc in enumerate(documents):
            print(f"\n文档 {i+1}:")
            print(f"  doc_id: {doc.get('doc_id')}")
            print(f"  section_title: {doc.get('section_title')}")
            print(f"  title_path: {doc.get('title_path')}")
            
            # 检查是否包含文件名信息
            if doc.get('section_title') or doc.get('title_path'):
                print(f"  ✅ 包含文件名: {doc.get('section_title') or doc.get('title_path')}")
            else:
                print("  ❌ 缺少文件名信息")
                all_have_filename = False
        
        if all_have_filename:
            print("\n🎉 所有文档都包含文件名信息！")
            return True
        else:
            print("\n❌ 部分文档缺少文件名信息！")
            return False
            
    except Exception as e:
        print(f"测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_document_info_api()