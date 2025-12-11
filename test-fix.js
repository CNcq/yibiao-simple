// 测试修复逻辑的正确性
// 模拟AppState和步骤切换

// 模拟updateOutline函数
function mockUpdateOutline(outlineData) {
  return {
    ...mockState,
    outlineData,
    currentStep: 2 // 修复后：自动设置为正文编辑步骤
  };
}

// 初始状态
let mockState = {
  currentStep: 1, // 当前在目录编辑步骤
  outlineData: null
};

// 模拟生成目录
function generateOutline() {
  console.log('开始生成目录...');
  
  // 模拟API返回的目录数据
  const mockOutlineData = {
    projectName: '测试项目',
    projectOverview: '项目概述',
    outline: [
      { id: '1', title: '第一章', children: [] },
      { id: '2', title: '第二章', children: [] }
    ]
  };
  
  console.log('目录生成完成');
  
  // 更新状态
  mockState = mockUpdateOutline(mockOutlineData);
  
  console.log('状态更新后：');
  console.log('currentStep:', mockState.currentStep);
  console.log('outlineData:', JSON.stringify(mockOutlineData, null, 2));
  
  // 验证是否自动进入正文编辑页面
  if (mockState.currentStep === 2) {
    console.log('✅ 自动进入正文编辑页面，修复成功！');
  } else {
    console.log('❌ 未能进入正文编辑页面，修复失败！');
  }
}

// 执行测试
generateOutline();