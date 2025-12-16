#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试嵌入式Milvus服务启动脚本
"""

import os
import sys
import time
from pymilvus import connections, utility
from pymilvus.embedded import MilvusServer

def start_embedded_milvus():
    """启动嵌入式Milvus服务"""
    print("正在启动嵌入式Milvus服务...")
    
    # 设置Milvus数据存储路径
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
    
    # 创建必要的目录
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(log_dir, exist_ok=True)
    
    try:
        # 启动嵌入式Milvus服务
        server = MilvusServer(
            data_dir=data_dir,
            log_dir=log_dir,
            log_level="info"
        )
        server.start()
        
        # 等待服务启动
        time.sleep(3)
        
        # 尝试连接
        print("正在连接到Milvus服务...")
        connections.connect(alias="default", host="127.0.0.1", port="19530")
        
        # 检查连接状态
        if connections.has_connection(alias="default"):
            print("✅ Milvus服务启动成功！")
            print(f"服务地址: 127.0.0.1:19530")
            print(f"数据存储路径: {data_dir}")
            print(f"日志路径: {log_dir}")
            
            # 保持服务运行
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\n正在关闭Milvus服务...")
                server.stop()
                print("✅ Milvus服务已关闭")
        else:
            print("❌ Milvus服务连接失败")
            server.stop()
            return False
            
    except Exception as e:
        print(f"❌ Milvus服务启动失败: {e}")
        return False

if __name__ == "__main__":
    # 确保在正确的目录中运行
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    if not start_embedded_milvus():
        sys.exit(1)
