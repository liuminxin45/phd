export const AUTO_AI_ENABLED_KEY = 'review-auto-ai-enabled';
export const AUTO_AI_JOBS_KEY = 'review-auto-ai-jobs';
export const AUTO_AI_RISK_MAP_KEY = 'review-auto-ai-risk-map';
export const AUTO_AI_RESULT_CACHE_KEY = 'review-auto-ai-result-cache';
export const AUTO_AI_MAX_LINES_KEY = 'review-auto-ai-max-lines';
export const AUTO_AI_PAUSE_UNTIL_KEY = 'review-auto-ai-pause-until';
export const AUTO_AI_ENABLED_AT_KEY = 'review-auto-ai-enabled-at';
export const AUTO_AI_MAX_CONCURRENCY = 2;
export const DEFAULT_AUTO_AI_MAX_LINES = 2000;
export const AUTO_AI_STATE_EVENT = 'review-auto-ai-state-change';
const AUTO_AI_DISK_SYNC_LOCK_KEY = 'review-auto-ai-sync-lock';
const AUTO_AI_DISK_SYNC_MARK_KEY = 'review-auto-ai-sync-mark';

export type AutoAiJobStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';
export type AutoAiJobSource = 'auto' | 'manual';

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
  source?: AutoAiJobSource;
}

export interface AutoAiCandidateChange {
  _number: number;
  current_revision?: string;
  subject?: string;
  owner?: { name?: string; email?: string; username?: string };
  insertions?: number;
  deletions?: number;
  updated?: string;
}

export interface PersistedAutoAiRiskSummary {
  changeNumber: number;
  riskLevel: 'low' | 'medium' | 'high';
  briefReason: string;
}

export interface PersistedAutoAiReviewResult {
  changeNumber: number;
  revision: string;
  usedModel?: string;
  overview: {
    riskLevel: 'low' | 'medium' | 'high';
    changeTypes: string[];
    summary: string;
    focusPoints: string[];
  };
  issues: any[];
  generatedAt: string;
}

interface PersistedAutoAiSnapshot {
  enabled?: boolean;
  enabledAt?: number | null;
  maxLines?: number;
  pauseUntil?: number | null;
  jobs?: Record<string, AutoAiJob>;
  riskMap?: Record<number, PersistedAutoAiRiskSummary>;
  resultCache?: Record<string, PersistedAutoAiReviewResult>;
  updatedAt?: string;
}

let persistTimer: number | null = null;
let hydratePromise: Promise<void> | null = null;

function dispatchAutoAiStateChange(keys?: string[]) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTO_AI_STATE_EVENT, { detail: { keys: keys || [] } }));
}

function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

function hasLocalStorageValueChanged(key: string, nextValue: string | null): boolean {
  const currentValue = readLocalStorage(key);
  return currentValue !== nextValue;
}

function queuePersistToDisk() {
  if (typeof window === 'undefined') return;
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void persistAutoAiStateToDisk();
  }, 120);
}

function applySnapshotToLocalStorage(snapshot: PersistedAutoAiSnapshot): boolean {
  let changed = false;

  const enabledValue = typeof snapshot.enabled === 'boolean' ? (snapshot.enabled ? '1' : '0') : null;
  if (enabledValue !== null && hasLocalStorageValueChanged(AUTO_AI_ENABLED_KEY, enabledValue)) {
    writeLocalStorage(AUTO_AI_ENABLED_KEY, enabledValue);
    changed = true;
  }

  const enabledAtValue = Number.isFinite(snapshot.enabledAt as number) && (snapshot.enabledAt as number) > 0
    ? String(snapshot.enabledAt)
    : null;
  if (snapshot.enabledAt !== undefined && hasLocalStorageValueChanged(AUTO_AI_ENABLED_AT_KEY, enabledAtValue)) {
    writeLocalStorage(AUTO_AI_ENABLED_AT_KEY, enabledAtValue);
    changed = true;
  }

  const maxLinesValue = Number.isFinite(snapshot.maxLines as number) && (snapshot.maxLines as number) > 0
    ? String(Math.floor(snapshot.maxLines as number))
    : null;
  if (snapshot.maxLines !== undefined && hasLocalStorageValueChanged(AUTO_AI_MAX_LINES_KEY, maxLinesValue)) {
    writeLocalStorage(AUTO_AI_MAX_LINES_KEY, maxLinesValue);
    changed = true;
  }

  const pauseUntilValue = Number.isFinite(snapshot.pauseUntil as number) && (snapshot.pauseUntil as number) > 0
    ? String(snapshot.pauseUntil)
    : null;
  if (snapshot.pauseUntil !== undefined && hasLocalStorageValueChanged(AUTO_AI_PAUSE_UNTIL_KEY, pauseUntilValue)) {
    writeLocalStorage(AUTO_AI_PAUSE_UNTIL_KEY, pauseUntilValue);
    changed = true;
  }

  if (snapshot.jobs && hasLocalStorageValueChanged(AUTO_AI_JOBS_KEY, JSON.stringify(snapshot.jobs))) {
    writeLocalStorage(AUTO_AI_JOBS_KEY, JSON.stringify(snapshot.jobs));
    changed = true;
  }

  if (snapshot.riskMap && hasLocalStorageValueChanged(AUTO_AI_RISK_MAP_KEY, JSON.stringify(snapshot.riskMap))) {
    writeLocalStorage(AUTO_AI_RISK_MAP_KEY, JSON.stringify(snapshot.riskMap));
    changed = true;
  }

  if (snapshot.resultCache && hasLocalStorageValueChanged(AUTO_AI_RESULT_CACHE_KEY, JSON.stringify(snapshot.resultCache))) {
    writeLocalStorage(AUTO_AI_RESULT_CACHE_KEY, JSON.stringify(snapshot.resultCache));
    changed = true;
  }

  if (changed) {
    writeLocalStorage(AUTO_AI_DISK_SYNC_MARK_KEY, String(Date.now()));
    dispatchAutoAiStateChange([
      AUTO_AI_ENABLED_KEY,
      AUTO_AI_ENABLED_AT_KEY,
      AUTO_AI_MAX_LINES_KEY,
      AUTO_AI_PAUSE_UNTIL_KEY,
      AUTO_AI_JOBS_KEY,
      AUTO_AI_RISK_MAP_KEY,
      AUTO_AI_RESULT_CACHE_KEY,
    ]);
  }

  return changed;
}

export async function hydrateAutoAiStateFromDisk(force = false): Promise<void> {
  if (typeof window === 'undefined') return;
  if (hydratePromise && !force) return hydratePromise;

  hydratePromise = fetch('/api/gerrit/ai-monitor-state')
    .then(async (response) => {
      if (!response.ok) throw new Error('Failed to load AI monitor state');
      const payload = await response.json();
      const snapshot = payload?.state as PersistedAutoAiSnapshot | null | undefined;
      if (!snapshot || typeof snapshot !== 'object') return;

      const hasLocalState =
        !!readLocalStorage(AUTO_AI_JOBS_KEY) ||
        !!readLocalStorage(AUTO_AI_RISK_MAP_KEY) ||
        !!readLocalStorage(AUTO_AI_RESULT_CACHE_KEY);

      if (!force && hasLocalState) return;
      applySnapshotToLocalStorage(snapshot);
    })
    .catch(() => {})
    .finally(() => {
      hydratePromise = null;
    });

  return hydratePromise;
}

export async function persistAutoAiStateToDisk(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (readLocalStorage(AUTO_AI_DISK_SYNC_LOCK_KEY) === '1') return;

  writeLocalStorage(AUTO_AI_DISK_SYNC_LOCK_KEY, '1');
  try {
    await fetch('/api/gerrit/ai-monitor-state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: {
          enabled: loadAutoAiEnabled(),
          enabledAt: loadAutoAiEnabledAt(),
          maxLines: loadAutoAiMaxLines(),
          pauseUntil: loadAutoAiPauseUntil(),
          jobs: loadAutoAiJobs(),
          riskMap: loadAutoAiRiskMap(),
          resultCache: loadAutoAiResultCache(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  } catch {
    // Keep local state even if disk sync fails.
  } finally {
    writeLocalStorage(AUTO_AI_DISK_SYNC_LOCK_KEY, null);
  }
}

export function getAutoAiJobKey(changeNumber: number, revisionId: string): string {
  return `${changeNumber}:${revisionId}`;
}

export function getAutoAiResultCacheKey(changeNumber: number, revisionId?: string, baseRevisionId?: string) {
  return `${changeNumber}:${revisionId || 'current'}:${baseRevisionId || 'parent'}`;
}

export function loadAutoAiEnabled(): boolean {
  const raw = readLocalStorage(AUTO_AI_ENABLED_KEY);
  return raw ? raw === '1' : true;
}

export function loadAutoAiPauseUntil(): number | null {
  const raw = readLocalStorage(AUTO_AI_PAUSE_UNTIL_KEY);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= Date.now()) return null;
  return parsed;
}

export function loadAutoAiMaxLines(): number {
  const raw = readLocalStorage(AUTO_AI_MAX_LINES_KEY);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_AUTO_AI_MAX_LINES;
  return Math.floor(parsed);
}

export function loadAutoAiJobs(): Record<string, AutoAiJob> {
  const raw = readLocalStorage(AUTO_AI_JOBS_KEY);
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadAutoAiRiskMap(): Record<number, PersistedAutoAiRiskSummary> {
  const raw = readLocalStorage(AUTO_AI_RISK_MAP_KEY);
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadAutoAiResultCache(): Record<string, PersistedAutoAiReviewResult> {
  const raw = readLocalStorage(AUTO_AI_RESULT_CACHE_KEY);
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadAutoAiEnabledAt(): number | null {
  const raw = readLocalStorage(AUTO_AI_ENABLED_AT_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function setAutoAiEnabled(enabled: boolean): number | null {
  const now = Date.now();
  const nextEnabled = enabled ? '1' : '0';
  const enabledChanged = hasLocalStorageValueChanged(AUTO_AI_ENABLED_KEY, nextEnabled);
  writeLocalStorage(AUTO_AI_ENABLED_KEY, nextEnabled);
  let enabledAtChanged = false;
  if (enabled) {
    const nextEnabledAt = String(now);
    enabledAtChanged = hasLocalStorageValueChanged(AUTO_AI_ENABLED_AT_KEY, nextEnabledAt);
    writeLocalStorage(AUTO_AI_ENABLED_AT_KEY, nextEnabledAt);
  }
  if (enabledChanged || enabledAtChanged) {
    dispatchAutoAiStateChange([AUTO_AI_ENABLED_KEY, AUTO_AI_ENABLED_AT_KEY]);
    queuePersistToDisk();
  }
  return enabled ? now : loadAutoAiEnabledAt();
}

export function ensureAutoAiEnabledAt(): number | null {
  const enabled = loadAutoAiEnabled();
  if (!enabled) return loadAutoAiEnabledAt();
  const existing = loadAutoAiEnabledAt();
  if (existing) return existing;
  const now = Date.now();
  writeLocalStorage(AUTO_AI_ENABLED_AT_KEY, String(now));
  dispatchAutoAiStateChange([AUTO_AI_ENABLED_AT_KEY]);
  queuePersistToDisk();
  return now;
}

export function setAutoAiMaxLines(value: number) {
  const safe = Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_AUTO_AI_MAX_LINES;
  const nextValue = String(safe);
  if (!hasLocalStorageValueChanged(AUTO_AI_MAX_LINES_KEY, nextValue)) return;
  writeLocalStorage(AUTO_AI_MAX_LINES_KEY, nextValue);
  dispatchAutoAiStateChange([AUTO_AI_MAX_LINES_KEY]);
  queuePersistToDisk();
}

export function setAutoAiPauseUntil(value: number | null) {
  const nextValue = value && value > Date.now() ? String(value) : null;
  if (!hasLocalStorageValueChanged(AUTO_AI_PAUSE_UNTIL_KEY, nextValue)) return;
  writeLocalStorage(AUTO_AI_PAUSE_UNTIL_KEY, nextValue);
  dispatchAutoAiStateChange([AUTO_AI_PAUSE_UNTIL_KEY]);
  queuePersistToDisk();
}

export function setAutoAiJobs(jobs: Record<string, AutoAiJob>) {
  const nextValue = JSON.stringify(jobs);
  if (!hasLocalStorageValueChanged(AUTO_AI_JOBS_KEY, nextValue)) return;
  writeLocalStorage(AUTO_AI_JOBS_KEY, nextValue);
  dispatchAutoAiStateChange([AUTO_AI_JOBS_KEY]);
  queuePersistToDisk();
}

export function setAutoAiRiskMap(riskMap: Record<number, PersistedAutoAiRiskSummary>) {
  const nextValue = JSON.stringify(riskMap);
  if (!hasLocalStorageValueChanged(AUTO_AI_RISK_MAP_KEY, nextValue)) return;
  writeLocalStorage(AUTO_AI_RISK_MAP_KEY, nextValue);
  dispatchAutoAiStateChange([AUTO_AI_RISK_MAP_KEY]);
  queuePersistToDisk();
}

export function setAutoAiResultCache(cache: Record<string, PersistedAutoAiReviewResult>) {
  const nextValue = JSON.stringify(cache);
  if (!hasLocalStorageValueChanged(AUTO_AI_RESULT_CACHE_KEY, nextValue)) return;
  writeLocalStorage(AUTO_AI_RESULT_CACHE_KEY, nextValue);
  dispatchAutoAiStateChange([AUTO_AI_RESULT_CACHE_KEY]);
  queuePersistToDisk();
}

export function saveAutoAiResultCacheEntry(
  cacheKey: string,
  result: PersistedAutoAiReviewResult
): Record<string, PersistedAutoAiReviewResult> {
  const existing = loadAutoAiResultCache();
  const next = {
    ...existing,
    [cacheKey]: result,
  };
  setAutoAiResultCache(next);
  return next;
}

function pickOwnerName(change: AutoAiCandidateChange): string | undefined {
  return change.owner?.name || change.owner?.username || change.owner?.email;
}

export function buildAutoAiJobFromChange(
  change: AutoAiCandidateChange,
  options?: { maxLines?: number; source?: AutoAiJobSource; now?: string; ignoreMaxLines?: boolean }
): AutoAiJob | null {
  const revisionId = change.current_revision ? String(change.current_revision) : '';
  if (!change._number || !revisionId) return null;
  const totalChangedLines = Math.max(0, (change.insertions || 0) + (change.deletions || 0));
  const maxLines = options?.maxLines ?? loadAutoAiMaxLines();
  const now = options?.now || new Date().toISOString();
  const shouldSkip = options?.ignoreMaxLines ? false : totalChangedLines > maxLines;

  return {
    key: getAutoAiJobKey(change._number, revisionId),
    changeNumber: change._number,
    revisionId,
    subject: change.subject,
    ownerName: pickOwnerName(change),
    totalChangedLines,
    status: shouldSkip ? 'skipped' : 'pending',
    createdAt: now,
    updatedAt: now,
    finishedAt: shouldSkip ? now : undefined,
    error: shouldSkip ? `Skipped: ${totalChangedLines} changed lines exceed limit ${maxLines}` : undefined,
    source: options?.source || 'auto',
  };
}

export function upsertAutoAiJobs(
  changes: AutoAiCandidateChange[],
  options?: { source?: AutoAiJobSource; maxLines?: number; preserveFinished?: boolean; ignoreMaxLines?: boolean }
): Record<string, AutoAiJob> {
  const prev = loadAutoAiJobs();
  const next: Record<string, AutoAiJob> = { ...prev };
  const now = new Date().toISOString();

  for (const change of changes) {
    const built = buildAutoAiJobFromChange(change, {
      source: options?.source,
      maxLines: options?.maxLines,
      now,
      ignoreMaxLines: options?.ignoreMaxLines,
    });
    if (!built) continue;

    const existing = next[built.key];
    if (!existing) {
      next[built.key] = built;
      continue;
    }

    if (options?.preserveFinished && existing.status !== 'pending' && existing.status !== 'running') {
      next[built.key] = {
        ...existing,
        subject: built.subject || existing.subject,
        ownerName: built.ownerName || existing.ownerName,
        totalChangedLines: built.totalChangedLines,
        source: existing.source || built.source,
      };
      continue;
    }

    next[built.key] = {
      ...existing,
      ...built,
      createdAt: existing.createdAt,
      source: existing.source || built.source,
    };
  }

  setAutoAiJobs(next);
  return next;
}

export function removeAutoAiJob(key: string): Record<string, AutoAiJob> {
  const prev = loadAutoAiJobs();
  if (!prev[key]) return prev;
  const next = { ...prev };
  delete next[key];
  setAutoAiJobs(next);
  return next;
}
