import { useCallback, useRef } from 'react';
import { OutlineItem } from '../../../types';

/**
 * 编辑器更新模块 - 提供编辑器内容更新的防抖和局部更新功能
 */

// 防抖延迟时间常量
export const DEBOUNCE_DELAY = 100; // 100毫秒的防抖延迟

/**
 * 创建一个防抖更新编辑器内容的函数
 * @param getEditorInstance 获取编辑器实例的函数
 * @returns 防抖更新编辑器内容的函数
 */
export const useDebouncedUpdateEditor = (getEditorInstance: () => any) => {
  // 使用useRef保存防抖定时器ID和上一次更新的内容，避免闭包问题
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedContentRef = useRef<string>('');

  return useCallback(async (content: string, item: OutlineItem) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(async () => {
      const editorInstance = getEditorInstance();
      if (editorInstance) {
        // 使用更高效的局部更新方法，只更新当前章节的内容
        try {
          const { state } = editorInstance;
          const { doc } = state;
          
          // 查找当前章节的h1标题，使用更灵活的匹配方式
          let chapterTitlePos = -1;
          let chapterTitleNode: any = null;
          
          doc.descendants((node: any, pos: number) => {
            if (node.type.name === 'heading' && node.attrs.level === 1) {
              // 去除首尾空格后比较，避免格式化差异导致匹配失败
              if (node.textContent.trim() === item.title.trim()) {
                chapterTitlePos = pos;
                chapterTitleNode = node;
                return false; // 停止查找
              }
            }
            return true;
          });
          
          if (chapterTitlePos !== -1 && chapterTitleNode) {
            // 找到标题后，计算内容开始位置
            const contentStartPos = chapterTitlePos + chapterTitleNode.nodeSize;
            let contentEndPos = doc.content.size; // 默认到文档结尾
            
            // 查找当前章节之后的下一个h1标题
            doc.descendants((node: any, pos: number) => {
              // 只查找当前章节之后的节点
              if (pos > chapterTitlePos) {
                if (node.type.name === 'heading' && node.attrs.level === 1) {
                  contentEndPos = pos;
                  return false; // 停止查找
                }
              }
              return true;
            });
            
            // 直接更新编辑器内容，不依赖outlineData状态
            if (contentEndPos > contentStartPos) {
              // 先删除旧内容，再插入新内容
              await editorInstance
                .chain()
                .focus()
                .deleteRange({ from: contentStartPos, to: contentEndPos })
                .insertContentAt(contentStartPos, content)
                .run();
            } else {
              // 没有旧内容，直接在标题后插入新内容
              await editorInstance
                .chain()
                .focus()
                .insertContentAt(contentStartPos, content)
                .run();
            }
          } else {
            // 找不到章节，可能是新章节，直接追加
            await editorInstance.commands.insertContent(`<h1>${item.title}</h1>${content}`);
          }
        } catch (err) {
          console.error('局部更新失败，回退到更健壮的更新方式:', err);
          // 回退到更健壮的更新方式，但仍保持实时性
          try {
            // 尝试更简单的方式：查找章节标题并替换其内容
            await editorInstance.chain().focus().run();
            
            // 先查找是否存在该章节的标题
            const contentHtml = editorInstance.getHTML();
            const titleRegex = new RegExp(`(<h1[^>]*>${item.title.trim()}</h1>)(.|\r\n)*?(?=<h1[^>]*>|$)`, 'i');
            const match = contentHtml.match(titleRegex);
            
            if (match) {
              // 替换章节内容
              const newContent = contentHtml.replace(titleRegex, `$1${content}`);
              await editorInstance.commands.setContent(newContent, { parseOptions: { preserveWhitespace: true } });
            } else {
              // 找不到章节标题，直接追加
              await editorInstance.commands.insertContent(`<h1>${item.title}</h1>${content}`);
            }
          } catch (fallbackErr) {
            console.error('所有更新方式均失败:', fallbackErr);
            // 保持lastUpdatedContent不变，避免无限重试
            return false;
          }
        }
        
        lastUpdatedContentRef.current = content;
      }
    }, DEBOUNCE_DELAY);
  }, [getEditorInstance]);
};
