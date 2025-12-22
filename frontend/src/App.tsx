/**
 * 主应用组件
 */
import React, { useState } from 'react';
import { useAppState } from './hooks/useAppState';
import ConfigPanel from './components/ConfigPanel';
import StepBar from './components/StepBar';
import DocumentAnalysis from './pages/DocumentAnalysis';
import OutlineEdit from './pages/OutlineEdit';
import ContentEdit from './pages/ContentEdit';
import KnowledgeBase from './pages/KnowledgeBase';


function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState<'bid' | 'knowledge'>('bid');
  const {
    state,
    updateConfig,
    updateStep,
    updateFileContent,
    updateAnalysisResults,
    updateOutline,
    updateSelectedChapter,
    nextStep,
    prevStep,
  } = useAppState();

  const steps = ['标书解析', '目录编辑', '正文编辑'];

  const renderCurrentPage = () => {
    if (activePage === 'knowledge') {
      return <KnowledgeBase />;
    }

    switch (state.currentStep) {
      case 0:
        return (
          <DocumentAnalysis
            fileContent={state.fileContent}
            projectOverview={state.projectOverview}
            techRequirements={state.techRequirements}
            onFileUpload={updateFileContent}
            onAnalysisComplete={updateAnalysisResults}
          />
        );
      case 1:
        return (
          <OutlineEdit
            projectOverview={state.projectOverview}
            techRequirements={state.techRequirements}
            outlineData={state.outlineData}
            onOutlineGenerated={updateOutline}
          />
        );
      case 2:
        return (
          <ContentEdit
            outlineData={state.outlineData}
            selectedChapter={state.selectedChapter}
            onChapterSelect={updateSelectedChapter}
            updateOutline={updateOutline}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左侧配置面板 */}
      <div className={`transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-80'}`}>
        <ConfigPanel config={state.config} onConfigChange={updateConfig} />
      </div>

      {/* 侧边栏切换按钮 - 独立定位，确保始终可见 */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className={`absolute top-1/2 z-20 flex items-center justify-center transition-all duration-300 ${sidebarCollapsed ? 'left-0' : 'left-80'} -translate-y-1/2`}
        aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        <div className={`h-16 w-8 ${sidebarCollapsed ? 'rounded-r-full' : 'rounded-l-full'} flex items-center justify-center transition-colors bg-blue-600 shadow-md hover:bg-blue-700`}>
          <svg className={`w-5 h-5 text-white transition-transform duration-300 ${sidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* 主内容区域 - 利用flex布局自动扩展 */}
      <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
        {/* 页面导航 */}
        <div className="bg-white shadow-sm px-6">
          {/* 功能模块切换 */}
          <div className="flex space-x-4 py-4 border-b">
            <button
              onClick={() => setActivePage('bid')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activePage === 'bid' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              标书生成
            </button>
            <button
              onClick={() => setActivePage('knowledge')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activePage === 'knowledge' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              知识库管理
            </button>
          </div>
          
          {/* 步骤导航 - 仅在标书生成页面显示 */}
          {activePage === 'bid' && (
            <div className="py-4">
              <StepBar steps={steps} currentStep={state.currentStep} />
            </div>
          )}
        </div>

        {/* 页面内容 */}
        <div className="flex-1 p-6 overflow-y-auto">
          {renderCurrentPage()}
        </div>

        {/* 底部导航按钮 - 仅在标书生成页面显示 */}
        {activePage === 'bid' && (
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex justify-between">
              <button
                onClick={prevStep}
                disabled={state.currentStep === 0}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                上一步
              </button>

              <button
              onClick={() => {
                console.log('点击下一步按钮，当前步骤:', state.currentStep);
                nextStep();
              }}
              disabled={state.currentStep === steps.length - 1 || (state.currentStep === 1 && !state.outlineData)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              下一步 ({state.currentStep}/{steps.length - 1})
            </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
