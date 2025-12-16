"""后端服务启动脚本"""
import uvicorn
import os
import multiprocessing
import argparse
import sys

if __name__ == "__main__":
    # 确保在正确的目录中运行
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="后端服务启动脚本")
    parser.add_argument("--port", type=int, default=8000, help="服务端口")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="服务地址")
    args = parser.parse_args()
    
    try:
        uvicorn.run(
            "app.main:app",
            host=args.host,
            port=args.port,
            reload=False,  # 多进程模式下不支持reload
            log_level="info",
            workers=multiprocessing.cpu_count() * 2,  # CPU核心数的2倍，最大化并发能力
            lifespan="on",  # 启用生命周期管理
            timeout_graceful_shutdown=10  # 优雅关闭超时时间
        )
    except Exception as e:
        print(f"后端服务启动失败: {e}", file=sys.stderr)
        sys.exit(1)  # 发生错误时返回非零退出码
    except KeyboardInterrupt:
        print("后端服务已被用户中断", file=sys.stdout)
        sys.exit(0)  # 正常退出