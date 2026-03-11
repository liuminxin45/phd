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

export interface LlmProfile {
  id: string;
  name: string;
  config: LlmConfig;
}

export interface LlmProfilesConfig {
  activeProfileId: string;
  profiles: LlmProfile[];
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

export const DEFAULT_LLM_PROFILE: LlmProfile = {
  id: 'default',
  name: '默认配置',
  config: { ...DEFAULT_LLM_CONFIG },
};

export const DEFAULT_LLM_PROFILES_CONFIG: LlmProfilesConfig = {
  activeProfileId: DEFAULT_LLM_PROFILE.id,
  profiles: [{ ...DEFAULT_LLM_PROFILE, config: { ...DEFAULT_LLM_CONFIG } }],
};

export interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
}

export const SESSION_KEYS = new Set(['PHA_SESSION', 'PHA_USER', 'DINNER_SESSION', 'CONTACTS_SESSION']);
export const SECRET_KEYS = new Set([
  'PHA_TOKEN',
  'LOGIN_PASS',
  'PHA_SESSION',
  'DINNER_SESSION',
  'CONTACTS_SESSION',
]);

export type TabId = 'llm' | 'env' | 'roadmap';
