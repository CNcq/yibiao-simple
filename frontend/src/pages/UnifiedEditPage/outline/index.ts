import { OutlineData, OutlineItem } from '../../../types';

/**
 * 收集所有叶子节点（末级章节）
 */
export const collectLeafItems = (items: OutlineItem[]): OutlineItem[] => {
  let leaves: OutlineItem[] = [];
  items.forEach(item => {
    // 如果章节被标记为不可见（已删除），则跳过
    if (item.visible === false) {
      return;
    }
    
    if (!item.children || item.children.length === 0) {
      leaves.push(item);
    } else {
      leaves = leaves.concat(collectLeafItems(item.children));
    }
  });
  return leaves;
};

/**
 * 生成完整的Markdown内容
 */
export const generateFullContent = (outlineData: OutlineData | null): string => {
  if (!outlineData?.outline) return '';
  
  const leafItems = collectLeafItems(outlineData.outline);
  
  return leafItems.map(item => {
    // 只生成可见章节的内容
    if (item.visible === false) return '';
    
    return `# ${item.title}

${item.content || '内容尚未生成'}

`;
  }).join('');
};

/**
 * 递归更新大纲内容
 */
export const updateContentInOutline = (items: OutlineItem[], chapters: { title: string; content: string }[]): OutlineItem[] => {
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

/**
 * 递归更新章节内容
 */
export const updateItemContent = (items: OutlineItem[], itemId: string, content: string): OutlineItem[] => {
  return items.map(item => {
    // 如果章节被标记为不可见（已删除），则跳过
    if (item.visible === false) {
      return item;
    }
    
    if (item.id === itemId) {
      return {
        ...item,
        content: content
      };
    }
    
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: updateItemContent(item.children, itemId, content)
      };
    }
    return item;
  });
};

/**
 * 递归更新章节prompt
 */
export const updateItemPrompt = (items: OutlineItem[], itemId: string, prompt: string): OutlineItem[] => {
  return items.map(item => {
    if (item.id === itemId) {
      return {
        ...item,
        prompt
      };
    }
    
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: updateItemPrompt(item.children, itemId, prompt)
      };
    }
    return item;
  });
};

/**
 * 根据ID查找章节
 */
export const findItemById = (items: OutlineItem[], itemId: string): OutlineItem | null => {
  for (const item of items) {
    if (item.id === itemId) {
      return item;
    }
    if (item.children && item.children.length > 0) {
      const found = findItemById(item.children, itemId);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

/**
 * 递归更新章节可见性（用于删除）
 */
export const updateItemVisibility = (items: OutlineItem[], itemId: string, visible: boolean): OutlineItem[] => {
  return items.map(item => {
    if (item.id === itemId) {
      // 标记为指定的可见状态
      return {
        ...item,
        visible
      };
    }
    
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: updateItemVisibility(item.children, itemId, visible)
      };
    }
    return item;
  });
};
