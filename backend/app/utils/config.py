"""Milvus配置管理"""
import json
import os
from typing import Dict, Optional


class MilvusConfig:
    """Milvus配置类"""
    
    def __init__(self):
        # 配置文件路径 - 存储到用户家目录中
        self.config_dir = os.path.join(os.path.expanduser("~"), ".ai_write_helper")
        self.config_file = os.path.join(self.config_dir, "milvus_config.json")
        
        # 确保配置目录存在
        os.makedirs(self.config_dir, exist_ok=True)
        
        # 加载配置
        self._config = self.load_config()
    
    def load_config(self) -> Dict:
        """从本地JSON文件加载Milvus配置"""
        default_config = {
            'host': 'localhost',
            'port': 19530,
            'collection_name': 'knowledge_base',
            'dimension': 1536,  # 默认使用OpenAI embedding维度
            'metric_type': 'L2',  # 距离度量类型：L2或IP
            'index_type': 'IVF_FLAT',  # 索引类型
            'nlist': 100,  # 索引参数
            'search_params': {"nprobe": 10}  # 搜索参数
        }
        
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded_config = json.load(f)
                    default_config.update(loaded_config)
            except Exception as e:
                print(f"加载Milvus配置失败: {e}")
                # 加载失败时使用默认配置
        
        return default_config
    
    def save_config(self, **kwargs) -> bool:
        """保存配置到本地JSON文件"""
        # 更新配置
        self._config.update(kwargs)
        
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self._config, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存Milvus配置失败: {e}")
            return False
    
    @property
    def host(self) -> str:
        """Milvus服务器主机地址"""
        return self._config.get('host', 'localhost')
    
    @host.setter
    def host(self, value: str):
        """设置Milvus服务器主机地址"""
        self.save_config(host=value)
    
    @property
    def port(self) -> int:
        """Milvus服务器端口"""
        return self._config.get('port', 19530)
    
    @port.setter
    def port(self, value: int):
        """设置Milvus服务器端口"""
        self.save_config(port=value)
    
    @property
    def collection_name(self) -> str:
        """Milvus集合名称"""
        return self._config.get('collection_name', 'knowledge_base')
    
    @collection_name.setter
    def collection_name(self, value: str):
        """设置Milvus集合名称"""
        self.save_config(collection_name=value)
    
    @property
    def dimension(self) -> int:
        """向量维度"""
        return self._config.get('dimension', 1536)
    
    @dimension.setter
    def dimension(self, value: int):
        """设置向量维度"""
        self.save_config(dimension=value)
    
    @property
    def metric_type(self) -> str:
        """距离度量类型"""
        return self._config.get('metric_type', 'L2')
    
    @metric_type.setter
    def metric_type(self, value: str):
        """设置距离度量类型"""
        if value not in ['L2', 'IP']:
            raise ValueError("metric_type must be 'L2' or 'IP'")
        self.save_config(metric_type=value)
    
    @property
    def index_type(self) -> str:
        """索引类型"""
        return self._config.get('index_type', 'IVF_FLAT')
    
    @index_type.setter
    def index_type(self, value: str):
        """设置索引类型"""
        self.save_config(index_type=value)
    
    @property
    def nlist(self) -> int:
        """索引参数nlist"""
        return self._config.get('nlist', 100)
    
    @nlist.setter
    def nlist(self, value: int):
        """设置索引参数nlist"""
        self.save_config(nlist=value)
    
    @property
    def search_params(self) -> Dict:
        """搜索参数"""
        return self._config.get('search_params', {"nprobe": 10})
    
    @search_params.setter
    def search_params(self, value: Dict):
        """设置搜索参数"""
        self.save_config(search_params=value)
    
    def get_all_config(self) -> Dict:
        """获取所有配置"""
        return self._config


# 全局Milvus配置实例
milvus_config = MilvusConfig()
