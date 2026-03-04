import type { ApiBlogPost } from '@/lib/blog/types';

export type AutoLikeResult = 'success' | 'skipped-liked' | 'no-candidate' | 'error';

export interface AutoLikeRecord {
  id: string;
  time: string;
  result: AutoLikeResult;
  postId?: number;
  postTitle?: string;
  tokenCount?: number;
  message?: string;
  traceId?: string;
}

export const AUTO_LIKE_ENABLED_KEY = 'blogs:auto-like:enabled';
export const AUTO_LIKE_INTERVAL_KEY = 'blogs:auto-like:interval';
export const AUTO_LIKE_RECORDS_KEY = 'blogs:auto-like:records';
export const MAX_AUTO_LIKE_RECORDS = 50;
export const MIN_AUTO_LIKE_INTERVAL_MINUTES = 1;
export const MAX_AUTO_LIKE_INTERVAL_MINUTES = 720;
const CANDIDATE_TOKEN_COUNT_THRESHOLD = 1;

export function clampAutoLikeInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_AUTO_LIKE_INTERVAL_MINUTES;
  }
  return Math.max(
    MIN_AUTO_LIKE_INTERVAL_MINUTES,
    Math.min(Math.floor(value), MAX_AUTO_LIKE_INTERVAL_MINUTES)
  );
}

export function pickAutoLikeCandidates(posts: ApiBlogPost[]): ApiBlogPost[] {
  return posts.filter((post) => (post.tokenCount || 0) >= CANDIDATE_TOKEN_COUNT_THRESHOLD);
}

export function shuffled<T>(list: T[], random: () => number = Math.random): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function createAutoLikeRecord(
  record: Omit<AutoLikeRecord, 'id' | 'time'>,
  now: Date = new Date()
): AutoLikeRecord {
  return {
    ...record,
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    time: now.toISOString(),
  };
}

export function trimAutoLikeRecords(records: AutoLikeRecord[]): AutoLikeRecord[] {
  return records.slice(0, MAX_AUTO_LIKE_RECORDS);
}

export function calcAutoLikeStats(records: AutoLikeRecord[]) {
  return records.reduce(
    (acc, record) => {
      if (record.result === 'success') acc.success += 1;
      if (record.result === 'skipped-liked') acc.skipped += 1;
      if (record.result === 'error') acc.errors += 1;
      return acc;
    },
    { total: records.length, success: 0, skipped: 0, errors: 0 }
  );
}
