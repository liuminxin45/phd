import { useState, useEffect, useCallback, useRef } from 'react';
import { httpPost } from '@/lib/httpClient';
import type { DashboardResponse } from '@/lib/gerrit/types';
import type { AiRiskSummary, AiReviewResult } from '@/lib/gerrit/ai-types';
import {
  AUTO_AI_STATE_EVENT,
  AUTO_AI_MAX_CONCURRENCY,
  DEFAULT_AUTO_AI_MAX_LINES,
  ensureAutoAiEnabledAt,
  getAutoAiResultCacheKey,
  hydrateAutoAiStateFromDisk,
  loadAutoAiEnabled,
  loadAutoAiEnabledAt,
  loadAutoAiJobs,
  loadAutoAiMaxLines,
  loadAutoAiPauseUntil,
  loadAutoAiRiskMap,
  saveAutoAiResultCacheEntry,
  setAutoAiEnabled as persistAutoAiEnabled,
  setAutoAiJobs as persistAutoAiJobs,
  setAutoAiMaxLines as persistAutoAiMaxLines,
  setAutoAiPauseUntil as persistAutoAiPauseUntil,
  setAutoAiRiskMap as persistAutoAiRiskMap,
  type AutoAiJob,
} from '@/lib/review/auto-ai';
import { getAccountName } from '@/lib/gerrit/helpers';

const AUTO_AI_RETRY_COOLDOWN_MS = 30 * 60 * 1000;

function isQuotaLimitedError(message: string): boolean {
  const text = (message || '').toLowerCase();
  return (
    text.includes('429') ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('too many requests') ||
    text.includes('limit') ||
    text.includes('exceeded')
  );
}

export interface AutoAiMonitorState {
  riskMap: Record<number, AiRiskSummary>;
  autoAiEnabled: boolean;
  setAutoAiEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  autoAiPauseUntil: number | null;
  autoAiJobs: Record<string, AutoAiJob>;
  autoAiStatusSummary: { pending: number; running: number; done: number; error: number };
}

export function useAutoAiMonitor(dashboard: DashboardResponse | null): AutoAiMonitorState {
  const [riskMap, setRiskMap] = useState<Record<number, AiRiskSummary>>({});
  const [autoAiEnabled, setAutoAiEnabled] = useState<boolean>(() => loadAutoAiEnabled());
  const [autoAiMaxLines, setAutoAiMaxLines] = useState(DEFAULT_AUTO_AI_MAX_LINES);
  const [autoAiPauseUntil, setAutoAiPauseUntil] = useState<number | null>(null);
  const [autoAiJobs, setAutoAiJobs] = useState<Record<string, AutoAiJob>>({});
  const [autoAiEnabledAt, setAutoAiEnabledAt] = useState<number | null>(null);

  // ── Load persisted state on mount ──────────────────────────────────────────
  useEffect(() => {
    void hydrateAutoAiStateFromDisk().finally(() => {
      setRiskMap(loadAutoAiRiskMap());
      setAutoAiMaxLines(loadAutoAiMaxLines());
      setAutoAiPauseUntil(loadAutoAiPauseUntil());
      setAutoAiJobs(loadAutoAiJobs());
      setAutoAiEnabled(loadAutoAiEnabled());
      setAutoAiEnabledAt(ensureAutoAiEnabledAt());
    });

    setRiskMap(loadAutoAiRiskMap());
    setAutoAiMaxLines(loadAutoAiMaxLines());
    setAutoAiPauseUntil(loadAutoAiPauseUntil());
    setAutoAiJobs(loadAutoAiJobs());
    setAutoAiEnabledAt(ensureAutoAiEnabledAt());
  }, []);

  // ── Persist state to localStorage ──────────────────────────────────────────
  useEffect(() => {
    const enabledAt = persistAutoAiEnabled(autoAiEnabled);
    setAutoAiEnabledAt(enabledAt);
  }, [autoAiEnabled]);

  useEffect(() => {
    persistAutoAiMaxLines(autoAiMaxLines);
  }, [autoAiMaxLines]);

  useEffect(() => {
    persistAutoAiPauseUntil(autoAiPauseUntil);
  }, [autoAiPauseUntil]);

  useEffect(() => {
    persistAutoAiJobs(autoAiJobs);
  }, [autoAiJobs]);

  useEffect(() => {
    persistAutoAiRiskMap(riskMap);
  }, [riskMap]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromStorage = () => {
      setRiskMap(loadAutoAiRiskMap());
      setAutoAiEnabled(loadAutoAiEnabled());
      setAutoAiMaxLines(loadAutoAiMaxLines());
      setAutoAiPauseUntil(loadAutoAiPauseUntil());
      setAutoAiJobs(loadAutoAiJobs());
      setAutoAiEnabledAt(loadAutoAiEnabledAt());
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('review-auto-ai-')) {
        syncFromStorage();
      }
    };

    const onCustomChange = () => {
      syncFromStorage();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(AUTO_AI_STATE_EVENT, onCustomChange as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(AUTO_AI_STATE_EVENT, onCustomChange as EventListener);
    };
  }, []);

  // ── Run a single AI review job ─────────────────────────────────────────────
  const runAutoAiReview = useCallback(async (job: AutoAiJob) => {
    try {
      const result = await httpPost<AiReviewResult>('/api/gerrit/ai-review', {
        changeNumber: job.changeNumber,
        revisionId: job.revisionId,
      });

      setAutoAiJobs((prev) => {
        const current = prev[job.key];
        if (!current) return prev;
        return {
          ...prev,
          [job.key]: {
            ...current,
            status: 'done',
            updatedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            error: undefined,
          },
        };
      });

      setRiskMap((prev) => ({
        ...prev,
        [job.changeNumber]: {
          changeNumber: job.changeNumber,
          riskLevel: result.overview.riskLevel,
          briefReason: result.overview.summary?.slice(0, 60) || 'Automatic analysis completed',
        },
      }));
      saveAutoAiResultCacheEntry(
        getAutoAiResultCacheKey(job.changeNumber, job.revisionId),
        result
      );
    } catch (err: any) {
      const message = err?.message || 'Automatic analysis failed';
      if (isQuotaLimitedError(message)) {
        const pauseUntil = Date.now() + AUTO_AI_RETRY_COOLDOWN_MS;
        const resumeAt = new Date(pauseUntil).toLocaleTimeString();
        const pauseReason = `Quota reached. Paused until ${resumeAt}`;
        setAutoAiPauseUntil(pauseUntil);
        setAutoAiJobs((prev) => {
          const next = { ...prev };
          const now = new Date().toISOString();
          for (const [key, item] of Object.entries(next)) {
            if (item.status === 'pending' || key === job.key) {
              next[key] = {
                ...item,
                status: 'pending',
                updatedAt: now,
                error: pauseReason,
              };
            }
          }
          return next;
        });
        return;
      }

      setAutoAiJobs((prev) => {
        const current = prev[job.key];
        if (!current) return prev;
        return {
          ...prev,
          [job.key]: {
            ...current,
            status: 'error',
            updatedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            error: message,
          },
        };
      });
    }
  }, []);

  // ── Enqueue jobs from dashboard changes ────────────────────────────────────
  useEffect(() => {
    if (!dashboard || !autoAiEnabled) return;

    const relatedSections = new Set([
      'Your Turn',
      'Incoming Reviews',
      'Outgoing Reviews',
      'CC\'ed On',
      '待我评审',
      '我发起的',
      '抄送我的',
    ]);
    const candidates = dashboard.sections
      .filter((s) => relatedSections.has(s.title))
      .flatMap((s) => s.changes)
      .filter((c) => c.status === 'NEW' && !!c.current_revision)
      .filter((c) => {
        if (!autoAiEnabledAt) return false;
        const updatedAt = Date.parse(c.updated || '');
        return Number.isFinite(updatedAt) && updatedAt >= autoAiEnabledAt;
      });

    setAutoAiJobs((prev) => {
      let changed = false;
      const next: Record<string, AutoAiJob> = { ...prev };
      const now = new Date().toISOString();

      for (const change of candidates) {
        const totalChangedLines = Math.max(0, (change.insertions || 0) + (change.deletions || 0));
        const revisionId = String(change.current_revision);
        const key = `${change._number}:${revisionId}`;
        const existing = next[key];
        const shouldSkip = totalChangedLines > autoAiMaxLines;
        const nextStatus: AutoAiJob['status'] = shouldSkip ? 'skipped' : 'pending';
        const skipReason = shouldSkip
          ? `Skipped: ${totalChangedLines} changed lines exceed limit ${autoAiMaxLines}`
          : undefined;
        if (!existing) {
          changed = true;
          next[key] = {
            key,
            changeNumber: change._number,
            revisionId,
            subject: change.subject,
            ownerName: getAccountName(change.owner),
            totalChangedLines,
            status: nextStatus,
            createdAt: now,
            updatedAt: now,
            finishedAt: shouldSkip ? now : undefined,
            error: skipReason,
            source: 'auto',
          };
          continue;
        }

        const nextSubject = change.subject || existing.subject;
        const nextOwnerName = getAccountName(change.owner) || existing.ownerName;
        if (
          existing.subject !== nextSubject ||
          existing.ownerName !== nextOwnerName ||
          existing.totalChangedLines !== totalChangedLines ||
          (existing.source === 'auto' && existing.status !== nextStatus) ||
          existing.error !== skipReason
        ) {
          changed = true;
          next[key] = {
            ...existing,
            subject: nextSubject,
            ownerName: nextOwnerName,
            totalChangedLines,
            status: existing.source === 'auto' ? nextStatus : existing.status,
            finishedAt: existing.source === 'auto' ? (shouldSkip ? (existing.finishedAt || now) : undefined) : existing.finishedAt,
            error: existing.source === 'auto' ? skipReason : existing.error,
          };
        }
      }

      const keys = Object.keys(next);
      if (keys.length > 300) {
        keys
          .sort((a, b) => (next[b]?.updatedAt || '').localeCompare(next[a]?.updatedAt || ''))
          .slice(300)
          .forEach((k) => {
            delete next[k];
            changed = true;
          });
      }

      return changed ? next : prev;
    });
  }, [autoAiEnabled, autoAiEnabledAt, autoAiMaxLines, dashboard]);

  // ── Dispatch pending jobs (respecting concurrency & pause) ─────────────────
  // Use a ref to avoid re-triggering the effect when jobs change from dispatching.
  const autoAiJobsRef = useRef(autoAiJobs);
  autoAiJobsRef.current = autoAiJobs;

  useEffect(() => {
    if (!autoAiEnabled) return;
    if (autoAiPauseUntil && autoAiPauseUntil > Date.now()) return;
    if (autoAiPauseUntil && autoAiPauseUntil <= Date.now()) {
      setAutoAiPauseUntil(null);
    }

    const jobs = Object.values(autoAiJobsRef.current);
    const runningCount = jobs.filter((j) => j.status === 'running').length;
    const slots = Math.max(0, AUTO_AI_MAX_CONCURRENCY - runningCount);
    if (slots <= 0) return;

    const pendingJobs = jobs
      .filter((j) => j.status === 'pending')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, slots);
    if (pendingJobs.length === 0) return;

    setAutoAiJobs((prev) => {
      const next = { ...prev };
      const now = new Date().toISOString();
      let changed = false;
      for (const job of pendingJobs) {
        const current = next[job.key];
        if (!current || current.status !== 'pending') continue;
        changed = true;
        next[job.key] = {
          ...current,
          status: 'running',
          updatedAt: now,
          startedAt: now,
        };
      }
      return changed ? next : prev;
    });

    pendingJobs.forEach((job) => {
      runAutoAiReview({
        ...job,
        status: 'running',
        updatedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAiEnabled, autoAiPauseUntil, runAutoAiReview]);

  // ── Compute summary ────────────────────────────────────────────────────────
  const autoAiStatusSummary = (() => {
    const allJobs = Object.values(autoAiJobs);
    return {
      pending: allJobs.filter((j) => j.status === 'pending').length,
      running: allJobs.filter((j) => j.status === 'running').length,
      done: allJobs.filter((j) => j.status === 'done').length,
      error: allJobs.filter((j) => j.status === 'error').length,
    };
  })();

  return {
    riskMap,
    autoAiEnabled,
    setAutoAiEnabled,
    autoAiPauseUntil,
    autoAiJobs,
    autoAiStatusSummary,
  };
}
