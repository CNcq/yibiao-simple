#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Project : yibiao-simple
# @File : qwen_openai_service.py
# @Author : Administrator
# @Date : 2025/12/8 14:58
# @Desc : OpenAI-Service → 千问兼容异步流式版


import os
import json
import asyncio
from typing import Dict, Any, List, AsyncGenerator
from openai import AsyncOpenAI  # 关键：异步客户端

from ..utils.outline_util import (
    get_random_indexes,
    calculate_nodes_distribution,
    generate_one_outline_json_by_level1,
)
from ..utils.json_util import check_json
from ..utils.config_manager import config_manager


class OpenAIService:
    """千问兼容端点异步流式实现"""

    def __init__(self):
        config = config_manager.load_config()
        # self.api_key = config.get("api_key") or os.getenv("DASHSCOPE_API_KEY")
        self.api_key = config.get('api_key') or 'sk-eb33ccdad18a4e50b1b4d530a7b0cef4'
        # 去掉尾部空格，避免 404
        self.base_url = (config.get("base_url") or "https://dashscope.aliyuncs.com/compatible-mode/v1").strip()
        self.model_name = config.get("model_name", "qwen-plus")  # 默认千问模型

        # 异步客户端
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    # ---------------- 模型列表 ----------------
    async def get_available_models(self) -> List[str]:
        """返回 DashScope 常用对话模型"""
        return [
            "qwen3-max",
        ]

    # ---------------- 流式对话 ----------------
    async def stream_chat_completion(
            self,
            messages: list,
            temperature: float = 0.7,
            response_format: dict = None,
    ) -> AsyncGenerator[str, None]:
        """千问异步流式生成，与官方示例 1:1 对应"""
        try:
            stream = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=temperature,
                stream=True,
                **({"response_format": response_format} if response_format else {}),
                stream_options={"include_usage": False},  # 可置 True 看用量
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            yield f"错误: {str(e)}"

    # ---------------- 以下业务逻辑完全不变 ----------------
    async def generate_content_for_outline(
            self, outline: Dict[str, Any], project_overview: str = ""
    ) -> Dict[str, Any]:
        import copy

        if not isinstance(outline, dict) or "outline" not in outline:
            raise Exception("无效的outline数据格式")
        result_outline = copy.deepcopy(outline)
        await self._process_outline_recursive(result_outline["outline"], [], project_overview)
        return result_outline

    async def _process_outline_recursive(
            self, chapters: list, parent_chapters: list = None, project_overview: str = ""
    ):
        for chapter in chapters:
            chapter_id = chapter.get("id", "unknown")
            chapter_title = chapter.get("title", "未命名章节")
            is_leaf = "children" not in chapter or not chapter.get("children", [])
            current_parent_chapters = (parent_chapters or []) + [
                {"id": chapter_id, "title": chapter_title, "description": chapter.get("description", "")}
            ]
            if is_leaf:
                content = ""
                async for ck in self._generate_chapter_content(
                        chapter, current_parent_chapters[:-1], chapters, project_overview
                ):
                    content += ck
                if content:
                    chapter["content"] = content
            else:
                await self._process_outline_recursive(chapter["children"], current_parent_chapters, project_overview)

    async def _generate_chapter_content(
            self,
            chapter: dict,
            parent_chapters: list = None,
            sibling_chapters: list = None,
            project_overview: str = "",
            prompt: str = None,
    ) -> AsyncGenerator[str, None]:
        try:
            chapter_id = chapter.get("id", "unknown")
            chapter_title = chapter.get("title", "未命名章节")
            chapter_description = chapter.get("description", "")

            system_prompt = """你是一个专业的标书编写专家，负责为投标文件的技术标部分生成具体内容。
要求：
1. 内容要专业、准确，与章节标题和描述保持一致
2. 这是技术方案，不是宣传报告，注意朴实无华，不要假大空
3. 语言要正式、规范，符合标书写作要求，但不要使用奇怪的连接词，不要让人觉得内容像是AI生成的
4. 内容要详细具体，避免空泛的描述
5. 注意避免与同级章节内容重复，保持内容的独特性和互补性
6. 直接返回章节内容，不生成标题，不要任何额外说明或格式标记
7. 可以参考知识库中的相关内容，但要确保生成的内容符合当前章节的需求，不要直接复制知识库内容
"""

            # 搜索知识库获取相关参考资料
            knowledge_base_content = ""
            try:
                from ..services.milvus_service import knowledge_base
                search_query = f"{chapter_title} {chapter_description} {project_overview[:500]}"
                search_results = knowledge_base.search(search_query, top_k=3)
                
                if search_results:
                    knowledge_base_content = "知识库参考内容：\n"
                    for i, result in enumerate(search_results):
                        print(result)
                        knowledge_base_content += f"参考{i+1} (相关性: {result['score']:.2f})：\n"
                        knowledge_base_content += f"标题: {result['title']}\n"
                        knowledge_base_content += f"内容: {result['content'][:500]}...\n\n"
            except Exception as e:
                # 如果知识库搜索失败，继续生成内容
                print(f"知识库搜索失败: {str(e)}")

            context_info = ""
            if parent_chapters:
                context_info += "上级章节信息：\n"
                for p in parent_chapters:
                    context_info += f"- {p['id']} {p['title']}\n  {p['description']}\n"
            if sibling_chapters:
                context_info += "同级章节信息（请避免内容重复）：\n"
                for s in sibling_chapters:
                    if s.get("id") != chapter_id:
                        context_info += f"- {s.get('id')} {s.get('title')}\n  {s.get('description', '')}\n"

            project_info = f"项目概述信息：\n{project_overview}\n\n" if project_overview.strip() else ""
            
            # 章节自定义提示词
            custom_prompt = f"\n\n自定义提示词：\n{prompt}\n"
            
            user_prompt = f"""请为以下标书章节生成具体内容：

{project_info}{context_info}{knowledge_base_content}当前章节信息：
章节ID: {chapter_id}
章节标题: {chapter_title}
章节描述: {chapter_description}
{custom_prompt if prompt else ''}

请根据项目概述信息、章节层级关系和知识库参考内容，生成详细的专业内容，确保与上级章节的内容逻辑相承，同时避免与同级章节内容重复，突出本章节的独特性和技术方案的优势。"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            async for delta in self.stream_chat_completion(messages, temperature=0.7):
                yield delta
        except Exception as e:
            yield f"错误: {str(e)}"

    # ---------------- 提纲生成 ----------------
    async def generate_outline_v2(self, overview: str, requirements: str) -> Dict[str, Any]:
        schema_json = json.dumps([{"rating_item": "原评分项", "new_title": "根据评分项修改的标题"}])
        system_prompt = (
            "### 角色\n你是专业的标书编写专家，擅长根据项目需求编写标书。\n\n"
            "### 任务\n1. 根据得到的项目概述(overview)和评分要求(requirements)，撰写技术标部分的一级提纲\n\n"
            "### 说明\n1. 只设计一级标题，数量要和“评分要求”一一对应\n"
            "2. 一级标题名称要进行简单修改，不能完全使用“评分要求”中的文字\n\n"
            f"### Output Format in JSON\n{schema_json}\n\n"
        )
        user_prompt = f"""### 项目信息\n<overview>\n{overview}\n</overview>\n\n<requirements>\n{requirements}\n</requirements>\n\n直接返回json，不要任何额外说明或格式标记"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        full_content = ""
        async for delta in self.stream_chat_completion(messages, temperature=0.7,
                                                       response_format={"type": "json_object"}):
            full_content += delta
        level_l1 = json.loads(full_content.strip())

        expected_word_count = 100_000
        leaf_node_count = expected_word_count // 1500
        index1, index2 = get_random_indexes(len(level_l1))
        nodes_distribution = calculate_nodes_distribution(len(level_l1), (index1, index2), leaf_node_count)

        tasks = [
            self.process_level1_node(i, node, nodes_distribution, level_l1, overview, requirements)
            for i, node in enumerate(level_l1)
        ]
        outline = await asyncio.gather(*tasks)
        return {"outline": outline}

    async def process_level1_node(
            self, i: int, level1_node: dict, nodes_distribution: list, level_l1: list, overview: str, requirements: str
    ) -> dict:
        json_outline = generate_one_outline_json_by_level1(level1_node["new_title"], i + 1, nodes_distribution)
        other_outline = "\n".join([f"{j + 1}. {n['new_title']}" for j, n in enumerate(level_l1) if j != i])

        system_prompt = (
            "### 角色\n你是专业的标书编写专家，擅长根据项目需求编写标书。\n\n"
            "### 任务\n1. 根据得到项目概述(overview)、评分要求(requirements)补全标书的提纲的二三级目录\n\n"
            "### 说明\n1. 你将会得到一段json，这是提纲的其中一个章节，你需要再原结构上补全标题(title)和描述(description)\n"
            "2. 二级标题根据一级标题撰写,三级标题根据二级标题撰写\n"
            "3. 补全的内容要参考项目概述(overview)、评分要求(requirements)等项目信息\n"
            "4. 你还会收到其他章节的标题(other_outline)，你需要确保本章节的内容不会包含其他章节的内容\n\n"
            "### 注意事项\n在原json上补全信息，禁止修改json结构，禁止修改一级标题\n\n"
            f"### Output Format in JSON\n{json_outline}\n\n"
        )
        user_prompt = f"""### 项目信息\n<overview>\n{overview}\n</overview>\n\n<requirements>\n{requirements}\n</requirements>\n\n<other_outline>\n{other_outline}\n</other_outline>\n\n直接返回json，不要任何额外说明或格式标记"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        for attempt in range(1, 4):
            full_content = ""
            async for delta in self.stream_chat_completion(messages, temperature=0.7,
                                                           response_format={"type": "json_object"}):
                full_content += delta
            ok, err = check_json(full_content.strip(), json_outline)
            if ok:
                return json.loads(full_content.strip())
            print(f"第{attempt}次重试：{err}")
            await asyncio.sleep(0.5)

        # 最大重试后仍失败，返回空结构
        return json.loads(json_outline)
