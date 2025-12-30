import { OutlineItem } from '../../../types';
import { updateItemVisibility, updateItemPrompt, collectLeafItems, findItemById } from '../outline';

// 更新章节要求
export const updateChapterRequirement = (
  chapterId: string,
  requirement: string,
  setChapterRequirements: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  outlineDataRef: React.RefObject<any>,
  updateOutline: (outlineData: any) => void
) => {
  setChapterRequirements((prev: Record<string, string>) => ({
    ...prev,
    [chapterId]: requirement
  }));
  
  // 更新outlineData中的prompt字段
  const latestOutlineData = outlineDataRef.current;
  if (!latestOutlineData?.outline) return;
  
  const updatedOutline = updateItemPrompt(latestOutlineData.outline, chapterId, requirement);
  updateOutline({
    ...latestOutlineData,
    outline: updatedOutline
  });
};

// 删除章节
export const deleteChapter = (
  chapterId: string,
  outlineDataRef: React.RefObject<any>,
  updateOutline: (outlineData: any) => void,
  setLeafItems: (leafItems: OutlineItem[]) => void,
  setChapterRequirements: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  editingChapterId: string | null,
  setEditingChapterId: (id: string | null) => void,
  getEditorInstance: () => any,
  generateFullContent: () => string
) => {
  const currentOutlineData = outlineDataRef.current;
  if (!currentOutlineData?.outline) return;
  
  // 更新outlineData，移除指定章节
  const updatedOutline = updateItemVisibility(currentOutlineData.outline, chapterId, false);
  
  // 创建更新后的outlineData对象
  const newOutlineData = {
    ...currentOutlineData,
    outline: updatedOutline
  };
  
  // 更新状态
  updateOutline(newOutlineData);
  
  // 立即更新outlineDataRef，确保后续操作使用最新的outlineData
  outlineDataRef.current = newOutlineData;

  // 直接使用updatedOutline更新leafItems，确保侧边栏立即反映删除操作
  // 这样可以绕过父组件outlineData可能的异步更新延迟
  const updatedLeafItems = collectLeafItems(updatedOutline);
  setLeafItems(updatedLeafItems);

  // 从章节要求中移除
  setChapterRequirements((prev: Record<string, string>) => {
    const newRequirements = {...prev};
    delete newRequirements[chapterId];
    return newRequirements;
  });
  
  // 如果当前正在编辑该章节，取消编辑
  if (editingChapterId === chapterId) {
    setEditingChapterId(null);
  }
  
  // 立即更新编辑器内容，移除已删除章节
  const editorInstance = getEditorInstance();
  if (editorInstance) {
    try {
      const { state } = editorInstance;
      const { doc } = state;
      
      // 查找要删除的章节的h1标题
      let chapterTitlePos = -1;
      let chapterTitleNode: any = null;
      
      // 先找到要删除的章节信息
      const deletedItem = findItemById(updatedOutline, chapterId);
      
      doc.descendants((node: any, pos: number) => {
        // 查找对应的章节标题
        if (!deletedItem) return true;
        
        if (node.type.name === 'heading' && node.attrs.level === 1 && node.textContent === deletedItem.title) {
          chapterTitlePos = pos;
          chapterTitleNode = node;
          return false; // 停止查找
        }
        return true;
      });
      
      if (chapterTitlePos !== -1 && chapterTitleNode) {
        // 找到标题后，查找章节的结束位置（下一个h1标题或文档结尾）
        let chapterEndPos = chapterTitlePos + chapterTitleNode.nodeSize;
        
        doc.descendants((node: any, pos: number) => {
          if (pos > chapterTitlePos && node.type.name === 'heading' && node.attrs.level === 1) {
            chapterEndPos = pos;
            return false; // 停止查找
          }
          return true;
        });
        
        // 如果没有找到下一个h1标题，章节结束位置就是文档结尾
        if (chapterEndPos <= chapterTitlePos + chapterTitleNode.nodeSize) {
          chapterEndPos = doc.content.size;
        }
        
        // 直接删除章节内容（包括标题和所有内容）
        editorInstance
            .chain()
            .focus()
            .deleteRange({ from: chapterTitlePos, to: chapterEndPos })
            .run();
        
        console.log('局部删除章节成功');
      } else {
        // 找不到章节时，回退到原来的全量更新方式
        const editorFallback = getEditorInstance();
        if (editorFallback) {
          editorFallback.commands.setContent(generateFullContent(), { parseOptions: { preserveWhitespace: true } });
          console.log('找不到章节，使用全量更新');
        }
      }
    } catch (err) {
      console.error('局部删除失败，回退到全量更新:', err);
      // 出现错误时，回退到原来的全量更新方式
      const editorFallback = getEditorInstance();
      if (editorFallback) {
        editorFallback.commands.setContent(generateFullContent(), { parseOptions: { preserveWhitespace: true } });
      }
    }
  }
};

// 回到顶部
export const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};