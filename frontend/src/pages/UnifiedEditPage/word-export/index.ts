import { OutlineData } from '../../../types';
import { documentApi } from '../../../services/api';
import { saveAs } from 'file-saver';

export interface WordStyleConfig {
  styleName: string;
  titleFormat: string;
  chapterStart: string;
  level1: { 
    font: string; 
    size: string; 
    bold: boolean; 
    italic: boolean; 
    underline: boolean; 
    align: string;
    firstLineIndent: boolean;
  };
  level2: { 
    font: string; 
    size: string; 
    bold: boolean; 
    italic: boolean; 
    underline: boolean; 
    align: string;
    firstLineIndent: boolean;
  };
  level3: { 
    font: string; 
    size: string; 
    bold: boolean; 
    italic: boolean; 
    underline: boolean; 
    align: string;
    firstLineIndent: boolean;
  };
  body: { 
    font: string; 
    size: string; 
    bold: boolean; 
    italic: boolean; 
    underline: boolean; 
    align: string;
    firstLineIndent: boolean;
  };
  orderedList: { 
    level1: string;
    level2: string;
    level3: string;
  };
  unorderedList: { 
    level1: string;
    level2: string;
    level3: string;
  };
}

// 获取默认的Word样式配置
export const getDefaultWordStyleConfig = (): WordStyleConfig => {
  return {
    styleName: '经典正式',
    titleFormat: '第一章/第一节',
    chapterStart: '第一章',
    level1: { font: '宋体', size: '三号', bold: true, italic: false, underline: false, align: 'center', firstLineIndent: false },
    level2: { font: '宋体', size: '四号', bold: true, italic: false, underline: false, align: 'left', firstLineIndent: false },
    level3: { font: '宋体', size: '小四号', bold: true, italic: false, underline: false, align: 'left', firstLineIndent: false },
    body: { font: '宋体', size: '小四号', bold: false, italic: false, underline: false, align: 'left', firstLineIndent: true },
    orderedList: { level1: '1/2/3', level2: '1/2/3', level3: '1/2/3' },
    unorderedList: { level1: '•/•/•', level2: '○/○/○', level3: '□/□/□' }
  };
};

// 导出Word文档
export const exportWordDocument = async (
  outlineData: OutlineData | null,
  styleConfig: WordStyleConfig,
  setIsExporting: (isExporting: boolean) => void,
  setError: (error: string | null) => void,
  onExportComplete: () => void
): Promise<void> => {
  if (!outlineData?.outline) return;
  
  setIsExporting(true);
  setError(null);
  
  try {
    const response = await documentApi.exportWord({ 
      project_name: outlineData.project_name || '投标技术文件',
      project_overview: outlineData.project_overview || '',
      outline: outlineData.outline || [],
      styleConfig: styleConfig // 传递用户选择的样式配置
    });
    const blob = await response.blob();
    saveAs(blob, `${outlineData.project_name || '投标技术文件'}.docx`);
    onExportComplete(); // 导出完成后的回调
  } catch (error) {
    console.error('导出Word文档失败:', error);
    setError('导出Word文档失败，请重试');
  } finally {
    setIsExporting(false);
  }
};