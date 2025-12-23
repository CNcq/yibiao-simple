import requests
import tempfile
import os

# 创建一个包含超过8192字符的测试文件
long_content = "a" * 12000  # 12000字符，超过8192限制

# 直接写入文件而不使用with语句
file_path = "test_long_file.txt"
with open(file_path, 'w') as f:
    f.write(long_content)

try:
    # 上传文件到默认分组
    url = "http://localhost:8000/api/knowledge-base/upload/默认"
    files = {'file': open(file_path, 'rb')}
    response = requests.post(url, files=files)
    
    print(f"响应状态码: {response.status_code}")
    print(f"响应内容: {response.json()}")
    
    if response.status_code == 200:
        print("✅ 文件上传成功！修复有效。")
        print("🎉 摘要长度限制问题已解决！")
    else:
        print("❌ 文件上传失败。")
finally:
    # 关闭文件后再删除
    if os.path.exists(file_path):
        os.remove(file_path)
        print(f"临时文件 {file_path} 已删除。")