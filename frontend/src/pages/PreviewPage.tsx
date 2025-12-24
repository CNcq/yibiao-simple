/**
 * 正文编辑页面 - 使用Tiptap编辑器编辑完整标书内容
 */
import React, { useState, useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
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
import { OutlineData, OutlineItem } from '../types';
import { documentApi } from '../services/api';
import { saveAs } from 'file-saver';

interface PreviewPageProps {
  outlineData: OutlineData | null;
}

const PreviewPage: React.FC<PreviewPageProps> = ({ outlineData }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 收集所有叶子节点
  const collectLeafItems = useCallback((items: OutlineItem[]): OutlineItem[] => {
    let leaves: OutlineItem[] = [];
    items.forEach(item => {
      if (!item.children || item.children.length === 0) {
        leaves.push(item);
      } else {
        leaves = leaves.concat(collectLeafItems(item.children));
      }
    });
    return leaves;
  }, []);

  // 生成完整的Markdown内容
  const generateFullContent = useCallback((): string => {
    if (!outlineData || !outlineData.outline) return '';
    
    const leafItems = collectLeafItems(outlineData.outline);
    
    return leafItems.map(item => {
      return `# ${item.title}

${item.content || '内容尚未生成'}

`;
    }).join('');
  }, [outlineData, collectLeafItems]);

  // 初始化Tiptap编辑器
  const editor = useEditor({
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
    content: generateFullContent(),
    editable: true,
  });

  // 导出Word文档
  const handleExportWord = async () => {
    if (!outlineData) return;
    
    setIsExporting(true);
    setError(null);
    
    try {
      const response = await documentApi.exportWord({ 
        project_name: outlineData.project_name || '投标技术文件',
        project_overview: outlineData.project_overview || '',
        outline: outlineData.outline || []
      });
      const blob = await response.blob();
      saveAs(blob, `${outlineData.project_name || '投标技术文件'}.docx`);
    } catch (error) {
      console.error('导出Word文档失败:', error);
      setError('导出Word文档失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  // 工具栏组件
  const EditorToolbar = () => {
    if (!editor) return null;

    return (
      <div className="bg-white border-b border-gray-200 p-1 flex items-center gap-1 mb-6 shadow-sm overflow-x-auto">
        {/* 基本操作 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            className="p-2 rounded hover:bg-gray-100 transition-all duration-200"
            title="撤销"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            className="px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors"
            title="重做"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7l-7 7-7-7m14 0h-2.343M12 12.343l-1.657-1.657M12 12.343l1.657-1.657" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 标题选择器 */}
        <div className="flex items-center gap-0.5">
          <select
            value={editor.isActive('heading') ? `h${editor.getAttributes('heading').level}` : 'paragraph'}
            onChange={(e) => {
              if (e.target.value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
              } else {
                const level = parseInt(e.target.value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
                editor.chain().focus().toggleHeading({ level }).run();
              }
            }}
            className="p-1 border border-gray-300 rounded hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="paragraph">正文</option>
            <option value="h1">标题 1</option>
            <option value="h2">标题 2</option>
            <option value="h3">标题 3</option>
            <option value="h4">标题 4</option>
            <option value="h5">标题 5</option>
            <option value="h6">标题 6</option>
          </select>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 文本样式 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('bold') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="加粗"
          >
            <b>B</b>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('italic') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="斜体"
          >
            <i>I</i>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('strike') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="删除线"
          >
            <s>S</s>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('underline') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="下划线"
          >
            <u>U</u>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 列表 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('bulletList') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="无序列表"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('orderedList') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="有序列表"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 对齐方式 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.getAttributes('paragraph').textAlign === 'left' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="左对齐"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.getAttributes('paragraph').textAlign === 'center' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="居中对齐"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.getAttributes('paragraph').textAlign === 'right' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="右对齐"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.getAttributes('paragraph').textAlign === 'justify' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="两端对齐"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 引用和代码 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('blockquote') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="引用"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('codeBlock') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="代码块"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded hover:bg-gray-100 transition-all duration-200 ${editor.isActive('code') ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            title="行内代码"
          >
            <code className="text-sm">code</code>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 链接和图片 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              const url = window.prompt('请输入链接地址:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className="p-2 rounded hover:bg-gray-100 transition-all duration-200 text-gray-700"
            title="插入链接"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          <button
            onClick={() => {
              const url = window.prompt('请输入图片地址:');
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            }}
            className="p-2 rounded hover:bg-gray-100 transition-all duration-200 text-gray-700"
            title="插入图片"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
        </div>

        {/* 分割线 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-2 rounded hover:bg-gray-100 transition-all duration-200 text-gray-700"
            title="插入分割线"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full mx-auto">
      {/* 顶部工具栏 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">正文编辑</h2>
              <p className="text-sm text-gray-500 mt-1">
                使用编辑器编辑完整的标书内容
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleExportWord}
                disabled={isExporting || !outlineData}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? '导出中...' : '导出Word'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 编辑器区域 */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* 编辑器工具栏 */}
        <EditorToolbar />
        
        {/* Tiptap编辑器内容 */}
        <div className="prose max-w-none">
          <EditorContent editor={editor} className="outline-none" />
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPage;