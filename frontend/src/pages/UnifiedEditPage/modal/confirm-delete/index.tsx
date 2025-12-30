import React from 'react';

interface ConfirmDeleteModalProps {
  visible: boolean;
  chapterId: string | null;
  chapterTitle: string | null;
  onCancel: () => void;
  onConfirm: (chapterId: string) => void;
}

/**
 * 确认删除章节的模态框组件
 */
export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  visible,
  chapterId,
  chapterTitle,
  onCancel,
  onConfirm,
}) => {
  if (!visible || !chapterId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">确认删除章节</h3>
        <p className="text-sm text-gray-600 mb-5">
          您确定要删除章节 "{chapterTitle}" 吗？此操作不可恢复，章节内容将被永久删除。
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(chapterId)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
};
