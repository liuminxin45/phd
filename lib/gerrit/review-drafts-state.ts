import fs from 'fs';
import path from 'path';

export interface PersistedReviewDraftComment {
  localKey: string;
  line: number;
  message: string;
  in_reply_to?: string;
  unresolved?: boolean;
}

export type PersistedReviewDraftComments = Record<string, PersistedReviewDraftComment[]>;

export interface PersistedReviewDraftEntry {
  key: string;
  changeNumber: number;
  revisionId?: string;
  comments: PersistedReviewDraftComments;
  updatedAt: string;
}

export interface PersistedReviewDraftState {
  drafts: Record<string, PersistedReviewDraftEntry>;
  updatedAt: string;
}

const PROJECT_ROOT = process.cwd();
const STATE_DIR = path.join(PROJECT_ROOT, 'data', 'ai-review');
const STATE_PATH = path.join(STATE_DIR, 'review-drafts-state.json');

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

export function readReviewDraftState(): PersistedReviewDraftState {
  try {
    if (!fs.existsSync(STATE_PATH)) {
      return { drafts: {}, updatedAt: new Date().toISOString() };
    }
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { drafts: {}, updatedAt: new Date().toISOString() };
    }
    const drafts = parsed.drafts && typeof parsed.drafts === 'object'
      ? parsed.drafts as Record<string, PersistedReviewDraftEntry>
      : {};
    return {
      drafts,
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return { drafts: {}, updatedAt: new Date().toISOString() };
  }
}

export function writeReviewDraftState(state: PersistedReviewDraftState): PersistedReviewDraftState {
  ensureStateDir();
  const next: PersistedReviewDraftState = {
    drafts: state.drafts || {},
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function getReviewDraftByKey(key: string): PersistedReviewDraftEntry | null {
  const state = readReviewDraftState();
  return state.drafts[key] || null;
}

export function upsertReviewDraftEntry(entry: PersistedReviewDraftEntry): PersistedReviewDraftEntry {
  const state = readReviewDraftState();
  state.drafts[entry.key] = {
    ...entry,
    comments: entry.comments || {},
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
  state.updatedAt = new Date().toISOString();
  writeReviewDraftState(state);
  return state.drafts[entry.key];
}

export function deleteReviewDraftByKey(key: string): boolean {
  const state = readReviewDraftState();
  if (!state.drafts[key]) return false;
  delete state.drafts[key];
  state.updatedAt = new Date().toISOString();
  writeReviewDraftState(state);
  return true;
}

export function deleteReviewDraftsByChangeNumber(changeNumber: number): number {
  const state = readReviewDraftState();
  const prefix = `review-pending-comments:${changeNumber}:`;
  const keys = Object.keys(state.drafts).filter((key) => key.startsWith(prefix));
  if (keys.length === 0) return 0;
  for (const key of keys) {
    delete state.drafts[key];
  }
  state.updatedAt = new Date().toISOString();
  writeReviewDraftState(state);
  return keys.length;
}
