export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stream: boolean;
  systemPrompt: string;
}

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: '',
  apiKey: '',
  model: '',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stream: false,
  systemPrompt: '你是一个公司内部效率工具助手，负责协助管理任务、项目进度、技术知识沉淀与周报复盘，以结构化、工程化、结果导向的方式提升个人与团队效率。',
};

export interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
}

export type StatusType = 'success' | 'error' | 'info';

export interface StatusState {
  message: string;
  type: StatusType;
}

export const EMPTY_STATUS: StatusState = { message: '', type: 'info' };

export const SESSION_KEYS = new Set(['PHA_SESSION', 'PHA_USER', 'DINNER_SESSION']);
export const SECRET_KEYS = new Set([
  'PHA_TOKEN',
  'LOGIN_PASS',
  'PHA_SESSION',
  'DINNER_SESSION',
]);

export type TabId = 'llm' | 'env';
