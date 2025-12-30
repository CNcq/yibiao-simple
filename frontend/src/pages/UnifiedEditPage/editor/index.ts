import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Blockquote from '@tiptap/extension-blockquote';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table, TableHeader } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { OutlineData, OutlineItem } from '../../../types';

/**
 * 初始化Tiptap编辑器
 */
export const useUnifiedEditor = (content: string, editable: boolean, onUpdate: (editor: any) => void) => {
  return useEditor({
    extensions: [
      StarterKit,
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      Bold,
      Italic,
      Underline,
      Strike,
      Code,
      CodeBlock,
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      HorizontalRule,
      Link.configure({
        openOnClick: true,
      }),
      Image,
      Table.configure({
        resizable: true,
      }),
      TableHeader,
      TableRow,
      TableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: '内容尚未生成',
      }),
      Markdown,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate(editor);
    },
  });
};

/**
 * 生成完整的Markdown内容
 */
export const generateFullContent = (outlineData: OutlineData | null): string => {
  if (!outlineData?.outline) return '';
  
  // 收集所有叶子节点
  const collectLeafItems = (items: OutlineItem[]): OutlineItem[] => {
    let leaves: OutlineItem[] = [];
    items.forEach(item => {
      if (item.visible === false) return;
      if (!item.children || item.children.length === 0) {
        leaves.push(item);
      } else {
        leaves = leaves.concat(collectLeafItems(item.children));
      }
    });
    return leaves;
  };
  
  const leafItems = collectLeafItems(outlineData.outline);
  
  return leafItems.map(item => {
    return `# ${item.title}

${item.content || '内容尚未生成'}

`;
  }).join('');
};

/**
 * 安全获取编辑器实例的辅助函数
 */
export const getEditorInstance = (editor: any, editorRef: React.RefObject<any>): any => {
  // 优先使用最新的editor变量
  if (editor) {
    return editor;
  }
  // 否则使用ref中保存的实例
  return editorRef.current;
};

/**
 * 将编辑器内容同步回outlineData
 */
export const syncEditorContentToOutline = (
  editor: any,
  outlineData: OutlineData | null,
  updateOutline: (outlineData: OutlineData) => void
) => {
  if (!editor || !outlineData?.outline) return;
  
  try {
    // 获取编辑器内容（HTML格式）
    const htmlContent = editor.getHTML();
    
    // 创建一个临时的DOM元素来解析HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // 获取所有的h1元素（章节标题）
    const h1Elements = tempDiv.querySelectorAll('h1');
    const chapters: { title: string; content: string }[] = [];
    
    h1Elements.forEach(h1 => {
      // 获取章节标题
      const title = h1.textContent?.trim() || '';
      
      // 获取章节内容（h1之后的所有内容，直到下一个h1或结束）
      let content = '';
      let nextSibling = h1.nextSibling;
      
      while (nextSibling && nextSibling.nodeName !== 'H1') {
        if (nextSibling.nodeType === Node.ELEMENT_NODE) {
          content += (nextSibling as HTMLElement).outerHTML;
        } else if (nextSibling.nodeType === Node.TEXT_NODE) {
          content += nextSibling.textContent;
        }
        nextSibling = nextSibling.nextSibling;
      }
      
      chapters.push({
        title,
        content: content.trim()
      });
    });
    
    // 更新outlineData中的章节内容
    let updatedOutline = [...outlineData.outline];
    
    // 递归更新函数
    const updateContentInOutline = (items: OutlineItem[], chapters: { title: string; content: string }[]): OutlineItem[] => {
      return items.map(item => {
        if (!item.children || item.children.length === 0) {
          // 叶子节点，查找对应的章节内容
          const chapter = chapters.find(ch => ch.title === item.title);
          if (chapter) {
            return {
              ...item,
              content: chapter.content
            };
          }
          return item;
        } else {
          // 非叶子节点，递归更新子节点
          return {
            ...item,
            children: updateContentInOutline(item.children, chapters)
          };
        }
      });
    };
    
    // 更新outlineData
    updatedOutline = updateContentInOutline(updatedOutline, chapters);
    
    // 调用updateOutline函数更新父组件状态
    updateOutline({
      ...outlineData,
      outline: updatedOutline
    });
    
  } catch (error) {
    console.error('同步编辑器内容到outline失败:', error);
  }
};
