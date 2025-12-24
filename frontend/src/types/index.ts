/**
 * 类型定义
 */

export interface ConfigData {
  api_key: string;
  base_url?: string;
  model_name: string;
}

export interface OutlineItem {
  id: string;
  title: string;
  description: string;
  children?: OutlineItem[];
  content?: string;
  prompt?: string;
  visible?: boolean;
}

export interface OutlineData {
  outline: OutlineItem[];
  project_name?: string;
  project_overview?: string;
}



export interface AppState {
  currentStep: number;
  config: ConfigData;
  fileContent: string;
  projectOverview: string;
  techRequirements: string;
  outlineData: OutlineData | null;
  selectedChapter: string;
}