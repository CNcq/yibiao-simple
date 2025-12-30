import React from 'react';
import { OutlineItem } from '../../../types';
import { KnowledgeBaseGroup } from '../knowledge-base';

/**
 * 侧边栏渲染模块 - 提供章节列表和知识库侧边栏的渲染功能
 */

/**
 * 章节侧边栏属性接口
 */
export interface ChapterSidebarProps {
  leafItems: OutlineItem[];
  editingChapterId: string | null;
  isGeneratingChapter: Set<string>;
  chapterRequirements: Record<string, string>;
  onSetEditingChapterId: (chapterId: string | null) => void;
  onUpdateChapterRequirement: (chapterId: string, requirement: string) => void;
  onGenerateChapterContent: (item: OutlineItem) => void;
  onCancelChapterGeneration: (itemId: string) => void;
  onSetConfirmDelete: (confirm: { visible: boolean; chapterId: string | null; chapterTitle: string }) => void;
}

/**
 * 渲染章节选择侧边栏
 */
export const renderChapterSidebar = (props: ChapterSidebarProps) => {
  const { 
    leafItems, 
    editingChapterId, 
    isGeneratingChapter, 
    chapterRequirements, 
    onSetEditingChapterId, 
    onUpdateChapterRequirement, 
    onGenerateChapterContent, 
    onCancelChapterGeneration, 
    onSetConfirmDelete 
  } = props;

  return React.createElement('div', { className: 'w-64 bg-white rounded-lg shadow h-full overflow-y-auto' },
    React.createElement('div', { className: 'p-4 border-b border-gray-200' },
      React.createElement('h3', { className: 'text-lg font-semibold text-gray-900' }, '章节列表')
    ),
    React.createElement('div', { className: 'p-4 space-y-3' },
      leafItems.map((item) => 
        React.createElement('div', { key: item.id, className: 'space-y-1' },
          React.createElement('div', { className: 'flex items-center justify-between' },
            React.createElement('div', { className: 'text-sm font-medium text-gray-900' }, item.title),
            React.createElement('div', { className: 'flex gap-1' },
              React.createElement('button', {
                onClick: () => onSetEditingChapterId(editingChapterId === item.id ? null : item.id),
                className: 'inline-flex items-center px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95',
                title: editingChapterId === item.id ? '收起要求' : '展开要求'
              },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: `h-3 w-3 mr-1 transition-transform duration-200 ${editingChapterId === item.id ? 'transform rotate-180' : ''}`, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M19 9l-7 7-7-7' })
                ),
                '要求'
              ),
              React.createElement('button', {
                onClick: () => onGenerateChapterContent(item),
                disabled: isGeneratingChapter.has(item.id),
                className: `inline-flex items-center px-2 py-1 text-xs rounded-md ${isGeneratingChapter.has(item.id) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95`
              },
                isGeneratingChapter.has(item.id) ? (
                  React.createElement(React.Fragment, null,
                    React.createElement('svg', { className: 'animate-spin -ml-1 mr-1 h-2.5 w-2.5 text-white', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                      React.createElement('circle', { className: 'opacity-25', cx: 12, cy: 12, r: 10, stroke: 'currentColor', strokeWidth: 4 }),
                      React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                    ),
                    '生成中...'
                  )
                ) : '生成'
              ),
              
              isGeneratingChapter.has(item.id) && (
                React.createElement('button', {
                  onClick: () => onCancelChapterGeneration(item.id),
                  className: 'inline-flex items-center px-2 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95',
                  title: '取消生成'
                },
                  React.createElement('svg', { className: 'h-3 w-3 mr-1', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M6 18L18 6M6 6l12 12' })
                  ),
                  '取消'
                )
              ),
              
              React.createElement('button', {
                onClick: () => onSetConfirmDelete({ visible: true, chapterId: item.id, chapterTitle: item.title }),
                className: 'inline-flex items-center px-2 py-1 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95',
                title: '删除章节'
              },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-3 w-3 mr-1', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                ),
                '删除'
              )
            )
          ),
          
          editingChapterId === item.id && (
            React.createElement('textarea', {
              value: chapterRequirements[item.id] || item.prompt || '',
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdateChapterRequirement(item.id, e.target.value),
              placeholder: '请输入章节要求...',
              className: 'w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none',
              rows: 3
            })
          )
        )
      )
    )
  );
};

/**
 * 知识库侧边栏属性接口
 */
export interface KnowledgeBaseSidebarProps {
  knowledgeBaseGroups: KnowledgeBaseGroup[];
  selectedKnowledgeBaseGroup: string;
  isLoadingGroups: boolean;
  onSetSelectedKnowledgeBaseGroup: (groupName: string) => void;
}

/**
 * 渲染知识库侧边栏
 */
export const renderKnowledgeBaseSidebar = (props: KnowledgeBaseSidebarProps) => {
  const { 
    knowledgeBaseGroups, 
    selectedKnowledgeBaseGroup, 
    isLoadingGroups, 
    onSetSelectedKnowledgeBaseGroup 
  } = props;

  return React.createElement('div', { className: 'w-80 bg-white rounded-lg shadow h-full overflow-y-auto' },
    React.createElement('div', { className: 'p-4 border-b border-gray-200' },
      React.createElement('h3', { className: 'text-lg font-semibold text-gray-900' }, '知识库')
    ),
    React.createElement('div', { className: 'p-4' },
      React.createElement('div', { className: 'mb-6' },
        React.createElement('h4', { className: 'text-sm font-medium text-gray-900 mb-2' }, '选择知识库分组'),
        isLoadingGroups ? (
          React.createElement('div', { className: 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-500' }, '加载中...')
        ) : (
          React.createElement('select', {
            value: selectedKnowledgeBaseGroup,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onSetSelectedKnowledgeBaseGroup(e.target.value),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          },
            knowledgeBaseGroups.map((group) => 
              React.createElement('option', { key: group.name, value: group.name }, group.name)
            )
          )
        )
      ),
      
      React.createElement('div', { className: 'mb-6' },
        React.createElement('h4', { className: 'text-sm font-medium text-gray-900 mb-2' }, '搜索知识库'),
        React.createElement('div', { className: 'flex items-center border border-gray-300 rounded-md overflow-hidden' },
          React.createElement('input', {
            type: 'text',
            placeholder: '搜索知识库内容...',
            className: 'flex-1 px-3 py-2 text-sm focus:outline-none'
          }),
          React.createElement('button', { className: 'px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700' },
            React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
              React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' })
            )
          )
        )
      ),
      
      React.createElement('div', { className: 'bg-gray-50 rounded-lg p-4' },
        React.createElement('h4', { className: 'text-sm font-medium text-gray-900 mb-2' }, '当前知识库: ' + (selectedKnowledgeBaseGroup || '未选择')),
        React.createElement('p', { className: 'text-xs text-gray-500' },
          selectedKnowledgeBaseGroup ? 
            `您当前正在使用"${selectedKnowledgeBaseGroup}"知识库进行章节内容生成。` : 
            '请选择一个知识库分组以开始生成内容。'
        )
      )
    )
  );
};