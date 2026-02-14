export const AUTO_AI_ENABLED_KEY = 'review-auto-ai-enabled';
export const AUTO_AI_JOBS_KEY = 'review-auto-ai-jobs';
export const AUTO_AI_MAX_LINES_KEY = 'review-auto-ai-max-lines';
export const AUTO_AI_PAUSE_UNTIL_KEY = 'review-auto-ai-pause-until';
export const AUTO_AI_MAX_CONCURRENCY = 2;
export const DEFAULT_AUTO_AI_MAX_LINES = 2000;

export type AutoAiJobStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface AutoAiJob {
  key: string;
  changeNumber: number;
  revisionId: string;
  subject?: string;
  ownerName?: string;
  totalChangedLines?: number;
  status: AutoAiJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export function loadAutoAiEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(AUTO_AI_ENABLED_KEY);
    return raw ? raw === '1' : true;
  } catch {
    return true;
  }
}

export function loadAutoAiPauseUntil(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTO_AI_PAUSE_UNTIL_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadAutoAiMaxLines(): number {
  if (typeof window === 'undefined') return DEFAULT_AUTO_AI_MAX_LINES;
  try {
    const raw = localStorage.getItem(AUTO_AI_MAX_LINES_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_AUTO_AI_MAX_LINES;
    return Math.floor(parsed);
  } catch {
    return DEFAULT_AUTO_AI_MAX_LINES;
  }
}

export function loadAutoAiJobs(): Record<string, AutoAiJob> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(AUTO_AI_JOBS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
