// ─── AI Review Structured Output Types ──────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';

export type IssueCategory = 'bug' | 'performance' | 'maintainability' | 'style';

export type ChangeType =
  | 'refactor'
  | 'new-feature'
  | 'bugfix'
  | 'config'
  | 'test'
  | 'docs'
  | 'dependency'
  | 'mixed';

export type FeedbackValue = 'helpful' | 'false-positive' | 'dismissed';

export type VerificationStatus = 'confirmed' | 'rejected' | 'uncertain';

export interface AiEvidence {
  file: string;
  line?: number;
  snippet: string;
}

export interface AiVerification {
  status: VerificationStatus;
  reason?: string;
}

export interface AiIssue {
  id: string;
  category: IssueCategory;
  severity: RiskLevel;
  title: string;
  description: string;
  confidence?: RiskLevel;
  file?: string;
  line?: number;
  suggestion?: string;
  evidence?: AiEvidence;
  verification?: AiVerification;
  feedback?: FeedbackValue;
  feedbackNote?: string;
}

export interface AiOverview {
  riskLevel: RiskLevel;
  changeTypes: ChangeType[];
  summary: string;
  focusPoints: string[];
}

export interface AiReviewResult {
  changeNumber: number;
  revision: string;
  usedModel?: string;
  overview: AiOverview;
  issues: AiIssue[];
  generatedAt: string;
}

/** Lightweight risk assessment for the change list page */
export interface AiRiskSummary {
  changeNumber: number;
  riskLevel: RiskLevel;
  briefReason: string;
}

/** Feedback entry persisted to localStorage */
export interface AiFeedbackEntry {
  issueId: string;
  changeNumber: number;
  revisionId?: string;
  baseRevisionId?: string;
  value: FeedbackValue;
  category?: IssueCategory;
  severity?: RiskLevel;
  title?: string;
  file?: string;
  line?: number;
  note?: string;
  timestamp: string;
}

/** Team rules configuration */
export interface AiTeamRules {
  enabled: boolean;
  customInstructions: string;
  focusAreas: string[];
  ignorePatterns: string[];
}

export const DEFAULT_TEAM_RULES: AiTeamRules = {
  enabled: true,
  customInstructions: '',
  focusAreas: [],
  ignorePatterns: [],
};

// ─── Category display helpers ───────────────────────────────────────────────

export const ISSUE_CATEGORY_META: Record<IssueCategory, { label: string; color: string; icon: string }> = {
  bug: { label: '潜在缺陷', color: 'text-red-600', icon: '🐛' },
  performance: { label: '性能优化', color: 'text-amber-600', icon: '⚡' },
  maintainability: { label: '代码维护性', color: 'text-blue-600', icon: '🔧' },
  style: { label: '代码风格', color: 'text-neutral-500', icon: '📐' },
};

export const RISK_LEVEL_META: Record<RiskLevel, { label: string; dotColor: string; textColor: string; bgColor: string; borderColor: string }> = {
  low: { label: '低风险', dotColor: 'bg-neutral-400', textColor: 'text-neutral-500', bgColor: 'bg-neutral-50', borderColor: 'border-neutral-200' },
  medium: { label: '中等风险', dotColor: 'bg-amber-400', textColor: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  high: { label: '高风险', dotColor: 'bg-red-500', textColor: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
};

export const CHANGE_TYPE_META: Record<ChangeType, string> = {
  'refactor': '重构',
  'new-feature': '新功能',
  'bugfix': '修复',
  'config': '配置',
  'test': '测试',
  'docs': '文档',
  'dependency': '依赖',
  'mixed': '混合',
};
