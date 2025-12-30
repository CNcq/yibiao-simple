import React from 'react';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { documentApi } from '../../../services/api';
import { saveAs } from 'file-saver';

/**
 * Word样式配置的默认值
 */
export const defaultWordStyleConfig = {
  styleName: '经典正式',
  titleFormat: '第一章/第一节',
  chapterStart: '第一章',
  level1: { font: '宋体', size: '三号', bold: true, italic: false, underline: false, align: 'left' },
  level2: { font: '宋体', size: '四号', bold: true, italic: false, underline: false, align: 'left' },
  level3: { font: '宋体', size: '小四', bold: true, italic: false, underline: false, align: 'left' },
  body: { font: '宋体', size: '小四', bold: false, italic: false, underline: false, align: 'left' },
  orderedList: { level1: '1/2/3', level2: '1/2/3', level3: '1/2/3' },
  unorderedList: { level1: '•/•/•', level2: '○/○/○', level3: '□/□/□' }
};

/**
 * 预设样式配置
 */
export const presetStyles = [
  { name: '经典正式', description: '传统的正式文档格式' },
  { name: '简洁商务', description: '简洁明了的商务风格' },
  { name: '专业学术', description: '适合学术论文的格式' },
  { name: '自定义', description: '用户自定义样式' }
];

/**
 * 渲染Word配置模态框
 */
export const renderWordConfigModal = ({
  visible,
  styleConfig,
  onStyleChange,
  onClose,
  onExport
}: {
  visible: boolean;
  styleConfig: any;
  onStyleChange: (config: any) => void;
  onClose: () => void;
  onExport: () => void;
}) => {
  if (!visible) return null;

  // 处理预设样式选择
  const handlePresetStyleChange = (styleName: string) => {
    // 这里可以根据选择的预设样式更新配置
    onStyleChange({
      ...styleConfig,
      styleName
    });
  };

  // 处理配置项变化
  const handleConfigChange = (section: string, property: string, value: any) => {
    onStyleChange({
      ...styleConfig,
      [section]: {
        ...styleConfig[section],
        [property]: value
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 my-8 flex flex-col md:flex-row">
        {/* 左侧预览区域 */}
        <div className="w-full md:w-1/2 p-6 border-r border-gray-200 overflow-y-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-4">预览</h3>
          <div className="bg-white p-6 border border-gray-200 rounded-lg">
            <h1 
              className="mb-4" 
              style={{
                fontSize: styleConfig.level1?.size === '二号' ? '20px' : 
                         styleConfig.level1?.size === '三号' ? '16px' : 
                         styleConfig.level1?.size === '四号' ? '14px' : 
                         styleConfig.level1?.size === '小四号' ? '12px' : '18px',
                fontWeight: styleConfig.level1?.bold ? 'bold' : 'normal',
                fontStyle: styleConfig.level1?.italic ? 'italic' : 'normal',
                textDecoration: styleConfig.level1?.underline ? 'underline' : 'none',
                textAlign: (styleConfig.level1?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
              }}
            >
              {styleConfig.chapterStart.replace('第', '').replace('章', '')}章 项目总体概述及运维方案
            </h1>
            <h2 
              className="mb-3"
              style={{
                fontSize: styleConfig.level2?.size === '二号' ? '20px' : 
                         styleConfig.level2?.size === '三号' ? '16px' : 
                         styleConfig.level2?.size === '四号' ? '14px' : 
                         styleConfig.level2?.size === '小四号' ? '12px' : '18px',
                fontWeight: styleConfig.level2?.bold ? 'bold' : 'normal',
                fontStyle: styleConfig.level2?.italic ? 'italic' : 'normal',
                textDecoration: styleConfig.level2?.underline ? 'underline' : 'none',
                textAlign: (styleConfig.level2?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
              }}
            >
              第{styleConfig.chapterStart.replace('第', '').replace('章', '')}节 项目背景
            </h2>
            <h3 
              className="mb-2"
              style={{
                fontSize: styleConfig.level3?.size === '二号' ? '20px' : 
                         styleConfig.level3?.size === '三号' ? '16px' : 
                         styleConfig.level3?.size === '四号' ? '14px' : 
                         styleConfig.level3?.size === '小四号' ? '12px' : '18px',
                fontWeight: styleConfig.level3?.bold ? 'bold' : 'normal',
                fontStyle: styleConfig.level3?.italic ? 'italic' : 'normal',
                textDecoration: styleConfig.level3?.underline ? 'underline' : 'none',
                textAlign: (styleConfig.level3?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
              }}
            >
              一、项目背景
            </h3>
            <p 
              className="mb-4"
              style={{
                fontSize: styleConfig.body?.size === '二号' ? '20px' : 
                         styleConfig.body?.size === '三号' ? '16px' : 
                         styleConfig.body?.size === '四号' ? '14px' : 
                         styleConfig.body?.size === '小四号' ? '12px' : '10px',
                fontWeight: styleConfig.body?.bold ? 'bold' : 'normal',
                fontStyle: styleConfig.body?.italic ? 'italic' : 'normal',
                textDecoration: styleConfig.body?.underline ? 'underline' : 'none',
                textAlign: (styleConfig.body?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
              }}
            >
              某某省某某市位于长江三角洲地区，是全国重要的经济中心和制造业基地。
              近年来，随着城市化进程的加速和工业化水平的提升，大气污染问题日益突出，
              给人民群众的生活带来了严重的影响。
            </p>
            <p 
              className="mb-4"
              style={{
                fontSize: styleConfig.body?.size === '三号' ? '16px' : 
                         styleConfig.body?.size === '四号' ? '14px' : 
                         styleConfig.body?.size === '小四号' ? '12px' : '10px',
                fontWeight: styleConfig.body?.bold ? 'bold' : 'normal',
                fontStyle: styleConfig.body?.italic ? 'italic' : 'normal',
                textDecoration: styleConfig.body?.underline ? 'underline' : 'none',
                textAlign: (styleConfig.body?.align || 'left') as 'left' | 'right' | 'center' | 'justify' | 'inherit'
              }}
            >
              为了改善空气质量，保障人民群众的身体健康，市政府决定实施大气污染防治
              专项行动，建设一套先进的大气环境监测系统，实时监控空气质量状况，
              为环境管理和决策提供科学依据。
            </p>
          </div>
        </div>
        {/* 右侧配置区域 */}
        <div className="w-full md:w-1/2 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Word格式配置</h3>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 样式选择 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">选择样式</h4>
            <div className="grid grid-cols-2 gap-2">
              {presetStyles.map((style) => (
                <button
                  key={style.name}
                  onClick={() => handlePresetStyleChange(style.name)}
                  className={`p-3 border rounded-md text-left ${styleConfig.styleName === style.name ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                  <div className="font-medium">{style.name}</div>
                  <div className="text-xs text-gray-500">{style.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 详细配置 */}
          <div className="space-y-6">
            {/* 标题格式 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">标题格式</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">标题格式</label>
                  <select
                    value={styleConfig.titleFormat}
                    onChange={(e) => handleConfigChange('titleFormat', '', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="第一章/第一节">第一章/第一节</option>
                    <option value="第1章/第1节">第1章/第1节</option>
                    <option value="Chapter 1/Section 1">Chapter 1/Section 1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">章节起始</label>
                  <input
                    type="text"
                    value={styleConfig.chapterStart}
                    onChange={(e) => handleConfigChange('chapterStart', '', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 一级标题样式 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">一级标题样式</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">字体</label>
                  <select
                    value={styleConfig.level1.font}
                    onChange={(e) => handleConfigChange('level1', 'font', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="宋体">宋体</option>
                    <option value="黑体">黑体</option>
                    <option value="微软雅黑">微软雅黑</option>
                    <option value="Arial">Arial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">字号</label>
                  <select
                    value={styleConfig.level1.size}
                    onChange={(e) => handleConfigChange('level1', 'size', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="二号">二号</option>
                    <option value="三号">三号</option>
                    <option value="四号">四号</option>
                    <option value="小四号">小四号</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">对齐方式</label>
                  <select
                    value={styleConfig.level1.align}
                    onChange={(e) => handleConfigChange('level1', 'align', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="left">左对齐</option>
                    <option value="center">居中</option>
                    <option value="right">右对齐</option>
                  </select>
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={styleConfig.level1.bold}
                      onChange={(e) => handleConfigChange('level1', 'bold', e.target.checked)}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700">加粗</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={styleConfig.level1.italic}
                      onChange={(e) => handleConfigChange('level1', 'italic', e.target.checked)}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700">斜体</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={styleConfig.level1.underline}
                      onChange={(e) => handleConfigChange('level1', 'underline', e.target.checked)}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700">下划线</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 二级标题样式 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">二级标题样式</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">字体</label>
                  <select
                    value={styleConfig.level2.font}
                    onChange={(e) => handleConfigChange('level2', 'font', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="宋体">宋体</option>
                    <option value="黑体">黑体</option>
                    <option value="微软雅黑">微软雅黑</option>
                    <option value="Arial">Arial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">字号</label>
                  <select
                    value={styleConfig.level2.size}
                    onChange={(e) => handleConfigChange('level2', 'size', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="二号">二号</option>
                    <option value="三号">三号</option>
                    <option value="四号">四号</option>
                    <option value="小四号">小四号</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">对齐方式</label>
                  <select
                    value={styleConfig.level2.align}
                    onChange={(e) => handleConfigChange('level2', 'align', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="left">左对齐</option>
                    <option value="center">居中</option>
                    <option value="right">右对齐</option>
                  </select>
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={styleConfig.level2.bold}
                      onChange={(e) => handleConfigChange('level2', 'bold', e.target.checked)}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700">加粗</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={styleConfig.level2.italic}
                      onChange={(e) => handleConfigChange('level2', 'italic', e.target.checked)}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700">斜体</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={styleConfig.level2.underline}
                      onChange={(e) => handleConfigChange('level2', 'underline', e.target.checked)}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700">下划线</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 正文样式 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">正文样式</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">字体</label>
                  <select
                    value={styleConfig.body.font}
                    onChange={(e) => handleConfigChange('body', 'font', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="宋体">宋体</option>
                    <option value="黑体">黑体</option>
                    <option value="微软雅黑">微软雅黑</option>
                    <option value="Arial">Arial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">字号</label>
                  <select
                    value={styleConfig.body.size}
                    onChange={(e) => handleConfigChange('body', 'size', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="二号">二号</option>
                    <option value="三号">三号</option>
                    <option value="四号">四号</option>
                    <option value="小四号">小四号</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">对齐方式</label>
                  <select
                    value={styleConfig.body.align}
                    onChange={(e) => handleConfigChange('body', 'align', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="left">左对齐</option>
                    <option value="center">居中</option>
                    <option value="right">右对齐</option>
                    <option value="justify">两端对齐</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 导出按钮 */}
          <div className="mt-8">
            <button
              onClick={onExport}
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
              导出Word文档
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 执行Word导出
 */
export const exportWordDocument = async (
  outlineData: any,
  styleConfig: any,
  setIsExporting: (isExporting: boolean) => void,
  setError: (error: string | null) => void,
  onExportComplete: () => void
) => {
  if (!outlineData?.outline) return;
  
  setIsExporting(true);
  setError(null);
  
  try {
    const response = await documentApi.exportWord({ 
      project_name: outlineData.project_name || '投标技术文件',
      project_overview: outlineData.project_overview || '',
      outline: outlineData.outline || [],
      styleConfig // 传递用户选择的样式配置
    });
    const blob = await response.blob();
    saveAs(blob, `${outlineData.project_name || '投标技术文件'}.docx`);
    onExportComplete();
  } catch (error) {
    console.error('导出Word文档失败:', error);
    setError('导出Word文档失败，请重试');
  } finally {
    setIsExporting(false);
  }
};

/**
 * 导出按钮组件
 */
export const ExportWordButton = ({ onClick, disabled, isExporting }: { onClick: () => void; disabled: boolean; isExporting: boolean }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
      {isExporting ? '导出中...' : '导出Word'}
    </button>
  );
};
