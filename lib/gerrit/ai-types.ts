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
  bug: { label: '潜在 Bug', color: 'text-red-600', icon: '🐛' },
  performance: { label: '性能风险', color: 'text-amber-600', icon: '⚡' },
  maintainability: { label: '可维护性', color: 'text-blue-600', icon: '🔧' },
  style: { label: '风格/一致性', color: 'text-neutral-500', icon: '📐' },
};

export const RISK_LEVEL_META: Record<RiskLevel, { label: string; dotColor: string; textColor: string; bgColor: string }> = {
  low: { label: '低风险', dotColor: 'bg-neutral-400', textColor: 'text-neutral-500', bgColor: 'bg-neutral-50' },
  medium: { label: '中风险', dotColor: 'bg-amber-400', textColor: 'text-amber-600', bgColor: 'bg-amber-50' },
  high: { label: '高风险', dotColor: 'bg-red-500', textColor: 'text-red-600', bgColor: 'bg-red-50' },
};
