import fs from 'fs';
import path from 'path';
import type {
  PersistedAutoAiReviewResult,
  PersistedAutoAiRiskSummary,
  AutoAiJob,
} from '@/lib/review/auto-ai';

const PROJECT_ROOT = process.cwd();
const STATE_DIR = path.join(PROJECT_ROOT, 'data', 'ai-review');
const STATE_PATH = path.join(STATE_DIR, 'monitor-state.json');

export interface PersistedAiMonitorState {
  enabled?: boolean;
  enabledAt?: number | null;
  maxLines?: number;
  pauseUntil?: number | null;
  jobs?: Record<string, AutoAiJob>;
  riskMap?: Record<number, PersistedAutoAiRiskSummary>;
  resultCache?: Record<string, PersistedAutoAiReviewResult>;
  updatedAt: string;
}

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

export function readAiMonitorState(): PersistedAiMonitorState | null {
  try {
    if (!fs.existsSync(STATE_PATH)) return null;
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as PersistedAiMonitorState;
  } catch {
    return null;
  }
}

export function writeAiMonitorState(state: PersistedAiMonitorState): PersistedAiMonitorState {
  ensureStateDir();
  const nextState: PersistedAiMonitorState = {
    ...state,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
  fs.writeFileSync(STATE_PATH, JSON.stringify(nextState, null, 2), 'utf-8');
  return nextState;
}
