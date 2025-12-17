#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基于Ubuntu的Milvus测试脚本
根据Milvus官方文档重写，适用于Milvus Lite和标准Milvus
"""

import os
import sys
import platform
from typing import List, Dict, Any

# 检查操作系统是否为Ubuntu
if not platform.system().lower() == "linux" or not "ubuntu" in platform.platform().lower():
    print("⚠️  此脚本设计用于Ubuntu系统，在其他系统上可能无法正常工作")

class UbuntuMilvusTester:
    """Ubuntu系统专用的Milvus测试工具类"""
    
    def __init__(self):
        """初始化测试工具"""
        self.client = None
        self.collection_name = "test_collection"
        # 确保data目录存在
        os.makedirs('./data', exist_ok=True)
        # 使用简单的相对路径URI，不使用绝对路径
        self.milvus_uri = "sqlite:///./data/milvus.db"  # 相对路径格式
        self.dimension = 128  # 向量维度
    
    def check_environment(self):
        """检查Milvus环境"""
        print("\n=== 检查Milvus环境 ===")
        
        try:
            # 检查Python版本
            python_version = platform.python_version()
            print(f"✅ Python版本: {python_version}")
            
            # 检查pymilvus是否安装
            try:
                import pymilvus
                print(f"✅ pymilvus版本: {pymilvus.__version__}")
            except ImportError:
                print("❌ pymilvus未安装，正在安装...")
                import subprocess
                subprocess.run([sys.executable, "-m", "pip", "install", "-U", "pymilvus"], check=True)
                import pymilvus
                print(f"✅ pymilvus安装成功，版本: {pymilvus.__version__}")
            
            return True
        except Exception as e:
            print(f"❌ 环境检查失败: {e}")
            return False
    
    def test_milvus_lite(self):
        """测试Milvus Lite功能"""
        print("\n=== 测试Milvus Lite功能 ===")
        
        try:
            from pymilvus import MilvusClient
            
            # 创建Milvus客户端
            print("📁 创建Milvus Lite客户端...")
            self.client = MilvusClient(uri=self.milvus_uri)
            print("✅ Milvus Lite客户端创建成功")
            
            # 列出所有数据库
            print("\n📋 列出所有数据库:")
            databases = self.client.list_databases()
            print(f"   {databases}")
            
            return True
        except Exception as e:
            print(f"❌ Milvus Lite测试失败: {e}")
            return False
    
    def test_collection_operations(self):
        """测试集合操作"""
        print("\n=== 测试集合操作 ===")
        
        try:
            # 创建集合
            print(f"📁 创建集合 '{self.collection_name}'...")
            self.client.create_collection(
                collection_name=self.collection_name,
                dimension=self.dimension
            )
            print(f"✅ 集合 '{self.collection_name}' 创建成功")
            
            # 检查集合是否存在
            exists = self.client.has_collection(collection_name=self.collection_name)
            print(f"✅ 集合存在性检查: {'存在' if exists else '不存在'}")
            
            # 列出所有集合
            print("\n📋 列出所有集合:")
            collections = self.client.list_collections()
            print(f"   {collections}")
            
            # 描述集合
            print(f"\n📋 描述集合 '{self.collection_name}':")
            collection_info = self.client.describe_collection(collection_name=self.collection_name)
            print(f"   集合名称: {collection_info['collection_name']}")
            print(f"   向量维度: {collection_info['fields'][1]['params']['dim']}")
            
            return True
        except Exception as e:
            print(f"❌ 集合操作测试失败: {e}")
            return False
    
    def test_data_operations(self):
        """测试数据操作"""
        print("\n=== 测试数据操作 ===")
        
        try:
            # 生成测试数据
            print("📝 生成测试数据...")
            import numpy as np
            test_data = []
            for i in range(10):
                # 生成随机向量
                vector = np.random.rand(self.dimension).tolist()
                # 创建测试文档
                doc = {
                    "id": i,
                    "vector": vector,
                    "title": f"测试文档{i}",
                    "content": f"这是第{i}个测试文档的内容",
                    "category": f"类别{i % 3}"
                }
                test_data.append(doc)
            
            # 插入数据
            print(f"📥 插入 {len(test_data)} 条测试数据...")
            self.client.insert(
                collection_name=self.collection_name,
                data=test_data
            )
            print("✅ 数据插入成功")
            
            # 查询数据
            print("\n🔍 查询数据...")
            results = self.client.query(
                collection_name=self.collection_name,
                filter="",  # 空过滤条件，查询所有数据
                output_fields=["*"],
                limit=5
            )
            print(f"✅ 查询成功，返回 {len(results)} 条数据")
            for i, result in enumerate(results[:3]):
                print(f"   文档{i+1}: 标题='{result['title']}', 类别='{result['category']}'")
            
            # 向量搜索
            print("\n🔎 向量搜索...")
            query_vector = np.random.rand(self.dimension).tolist()
            search_results = self.client.search(
                collection_name=self.collection_name,
                data=[query_vector],
                limit=3,
                output_fields=["title", "category"]
            )
            print(f"✅ 搜索成功，返回 {len(search_results[0])} 个结果")
            for i, result in enumerate(search_results[0]):
                print(f"   结果{i+1}: 标题='{result['entity']['title']}', 分数='{result['distance']:.4f}'")
            
            return True
        except Exception as e:
            print(f"❌ 数据操作测试失败: {e}")
            return False
    
    def test_standard_milvus(self):
        """测试标准Milvus连接（可选）"""
        print("\n=== 测试标准Milvus连接（可选） ===")
        
        try:
            from pymilvus import connections
            
            # 尝试连接到标准Milvus（默认端口19530）
            print("📡 尝试连接到标准Milvus服务...")
            connections.connect(alias='standard', uri='tcp://localhost:19530')
            print("✅ 标准Milvus连接成功")
            
            # 列出所有集合
            from pymilvus import utility
            collections = utility.list_collections(using='standard')
            print(f"📋 标准Milvus集合列表: {collections}")
            
            # 断开连接
            connections.disconnect(alias='standard')
            return True
        except Exception as e:
            print(f"⚠️  标准Milvus连接失败（这可能是正常的，因为您可能没有安装标准Milvus）: {e}")
            return False
    
    def cleanup(self):
        """清理测试数据"""
        print("\n=== 清理测试数据 ===")
        
        try:
            # 删除集合
            if self.client and self.client.has_collection(collection_name=self.collection_name):
                print(f"🗑️ 删除集合 '{self.collection_name}'...")
                self.client.drop_collection(collection_name=self.collection_name)
                print(f"✅ 集合 '{self.collection_name}' 删除成功")
            
            # 删除数据库文件（可选）
            database_path = "./data/milvus.db"  # 直接使用数据库文件路径
            if os.path.exists(database_path):
                print(f"🗑️ 删除数据库文件 '{database_path}'...")
                os.remove(database_path)
                print(f"✅ 数据库文件 '{database_path}' 删除成功")
            
            return True
        except Exception as e:
            print(f"❌ 清理失败: {e}")
            return False
    
    def run_all_tests(self):
        """运行所有测试"""
        print("🚀 Ubuntu Milvus测试脚本开始运行")
        print("=" * 50)
        
        # 运行测试
        results = {
            "环境检查": self.check_environment(),
            "Milvus Lite测试": False,
            "集合操作测试": False,
            "数据操作测试": False,
            "标准Milvus连接": False
        }
        
        if results["环境检查"]:
            results["Milvus Lite测试"] = self.test_milvus_lite()
            
            if results["Milvus Lite测试"]:
                results["集合操作测试"] = self.test_collection_operations()
                
                if results["集合操作测试"]:
                    results["数据操作测试"] = self.test_data_operations()
            
            # 测试标准Milvus连接（可选）
            results["标准Milvus连接"] = self.test_standard_milvus()
        
        # 总结测试结果
        print("\n" + "=" * 50)
        print("📊 测试结果总结:")
        for test_name, passed in results.items():
            status = "✅" if passed else "❌"
            print(f"{status} {test_name}")
        
        passed_count = sum(results.values())
        total_count = len(results)
        
        print("\n" + "=" * 50)
        if passed_count == total_count:
            print("🎉 所有测试通过！")
        else:
            print(f"💥 {passed_count}/{total_count} 测试通过")
            print("注意: 标准Milvus连接失败是正常的，除非您已安装并运行标准Milvus服务")
        
        # 询问是否清理测试数据
        cleanup = input("\n是否清理测试数据？(y/N): ")
        if cleanup.lower() == 'y':
            self.cleanup()
        else:
            print("ℹ️  测试数据已保留，可在后续测试中继续使用")
        
        return True

def main():
    """主函数"""
    tester = UbuntuMilvusTester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()