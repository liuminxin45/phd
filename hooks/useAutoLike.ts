import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { httpGet, httpPost } from '@/lib/httpClient';
import { appStorage } from '@/lib/appStorage';
import type { ApiBlogPost, PostsResponse } from '@/lib/blog/types';
import {
  AUTO_LIKE_ENABLED_KEY,
  AUTO_LIKE_INTERVAL_KEY,
  AUTO_LIKE_RECORDS_KEY,
  AutoLikeRecord,
  calcAutoLikeStats,
  clampAutoLikeInterval,
  createAutoLikeRecord,
  MAX_AUTO_LIKE_RECORDS,
  pickAutoLikeCandidates,
  shuffled,
  trimAutoLikeRecords,
} from '@/lib/blog/autoLike';

type FetchPostsFn = (params: Record<string, any>) => Promise<PostsResponse>;

interface UseAutoLikeOptions {
  fetchPosts: FetchPostsFn;
  refreshTechPosts: () => Promise<void>;
}

interface LikeStatusResponse {
  hasLiked: boolean;
}

interface LikePostResponse {
  success: boolean;
  verified?: boolean;
  hasLikedAfter?: boolean;
  traceId?: string;
}

export function useAutoLike({ fetchPosts, refreshTechPosts }: UseAutoLikeOptions) {
  const [autoLikeEnabled, setAutoLikeEnabled] = useState(false);
  const [autoLikeIntervalMinutes, setAutoLikeIntervalMinutes] = useState(15);
  const [autoLikeRecords, setAutoLikeRecords] = useState<AutoLikeRecord[]>([]);
  const [showAutoLikeRecords, setShowAutoLikeRecords] = useState(false);
  const [autoLikeRunning, setAutoLikeRunning] = useState(false);
  const [autoLikeDialogOpen, setAutoLikeDialogOpen] = useState(false);
  const [autoLikeStorageReady, setAutoLikeStorageReady] = useState(false);
  const autoLikeRunningRef = useRef(false);

  const autoLikeStats = useMemo(() => calcAutoLikeStats(autoLikeRecords), [autoLikeRecords]);

  const appendAutoLikeRecord = useCallback((record: Omit<AutoLikeRecord, 'id' | 'time'>) => {
    const next = createAutoLikeRecord(record);
    setAutoLikeRecords((prev) => trimAutoLikeRecords([next, ...prev]));
  }, []);

  const clearAutoLikeRecords = useCallback(() => {
    setAutoLikeRecords([]);
  }, []);

  const onIntervalInput = useCallback((rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    setAutoLikeIntervalMinutes(clampAutoLikeInterval(parsed));
  }, []);

  const runAutoLike = useCallback(async () => {
    if (autoLikeRunningRef.current) return;

    autoLikeRunningRef.current = true;
    setAutoLikeRunning(true);

    try {
      const latest = await fetchPosts({ type: 'tech', sort: 'newest', limit: 50 });
      const candidates = pickAutoLikeCandidates(latest.data);

      if (candidates.length === 0) {
        appendAutoLikeRecord({
          result: 'no-candidate',
          message: '最新文章中没有点赞数 >= 1 的候选文章',
        });
        return;
      }

      const candidateQueue = shuffled(candidates);
      let skippedCount = 0;
      let lastError: { post?: ApiBlogPost; message: string; traceId?: string } | null = null;

      for (const candidate of candidateQueue) {
        try {
          const likeStatus = await httpGet<LikeStatusResponse>('/api/blogs/token', {
            objectPHID: candidate.phid,
          });
          if (likeStatus.hasLiked) {
            skippedCount += 1;
            continue;
          }

          const likeResult = await httpPost<LikePostResponse>('/api/blogs/token', {
            objectPHID: candidate.phid,
          });

          if (!likeResult.success || likeResult.verified !== true || likeResult.hasLikedAfter !== true) {
            lastError = {
              post: candidate,
              message: `点赞未通过后验校验（traceId=${likeResult.traceId || 'n/a'}）`,
              traceId: likeResult.traceId,
            };
            continue;
          }

          appendAutoLikeRecord({
            result: 'success',
            postId: candidate.id,
            postTitle: candidate.title,
            tokenCount: candidate.tokenCount,
            traceId: likeResult.traceId,
            message:
              skippedCount > 0
                ? `本轮先跳过 ${skippedCount} 篇已点赞文章后成功点赞（traceId=${likeResult.traceId || 'n/a'}）`
                : `自动点赞成功（traceId=${likeResult.traceId || 'n/a'}）`,
          });
          await refreshTechPosts();
          return;
        } catch (error: any) {
          lastError = {
            post: candidate,
            message: error?.message || '点赞或检查点赞状态失败',
          };
        }
      }

      if (lastError) {
        appendAutoLikeRecord({
          result: 'error',
          postId: lastError.post?.id,
          postTitle: lastError.post?.title,
          tokenCount: lastError.post?.tokenCount,
          traceId: lastError.traceId,
          message:
            skippedCount > 0
              ? `${lastError.message}（本轮已跳过 ${skippedCount} 篇已点赞文章）`
              : lastError.message,
        });
        return;
      }

      appendAutoLikeRecord({
        result: 'skipped-liked',
        message: `候选文章共 ${candidates.length} 篇，均已点赞，已全部跳过`,
      });
    } finally {
      autoLikeRunningRef.current = false;
      setAutoLikeRunning(false);
    }
  }, [appendAutoLikeRecord, fetchPosts, refreshTechPosts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [enabled, interval, records] = await Promise.all([
        appStorage.get<boolean>(AUTO_LIKE_ENABLED_KEY),
        appStorage.get<number>(AUTO_LIKE_INTERVAL_KEY),
        appStorage.get<AutoLikeRecord[]>(AUTO_LIKE_RECORDS_KEY),
      ]);
      if (cancelled) return;

      if (typeof enabled === 'boolean') {
        setAutoLikeEnabled(enabled);
      }
      if (typeof interval === 'number' && Number.isFinite(interval)) {
        setAutoLikeIntervalMinutes(clampAutoLikeInterval(interval));
      }
      if (Array.isArray(records)) {
        setAutoLikeRecords(trimAutoLikeRecords(records));
      }
      setAutoLikeStorageReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!autoLikeStorageReady) return;
    void appStorage.set<boolean>(AUTO_LIKE_ENABLED_KEY, autoLikeEnabled);
  }, [autoLikeEnabled, autoLikeStorageReady]);

  useEffect(() => {
    if (!autoLikeStorageReady) return;
    void appStorage.set<number>(AUTO_LIKE_INTERVAL_KEY, autoLikeIntervalMinutes);
  }, [autoLikeIntervalMinutes, autoLikeStorageReady]);

  useEffect(() => {
    if (!autoLikeStorageReady) return;
    void appStorage.set<AutoLikeRecord[]>(AUTO_LIKE_RECORDS_KEY, autoLikeRecords);
  }, [autoLikeRecords, autoLikeStorageReady]);

  useEffect(() => {
    if (!autoLikeEnabled) return;
    runAutoLike();
    const timer = window.setInterval(() => {
      runAutoLike();
    }, clampAutoLikeInterval(autoLikeIntervalMinutes) * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [autoLikeEnabled, autoLikeIntervalMinutes, runAutoLike]);

  return {
    autoLikeEnabled,
    setAutoLikeEnabled,
    autoLikeIntervalMinutes,
    autoLikeRecords,
    autoLikeStats,
    showAutoLikeRecords,
    setShowAutoLikeRecords,
    autoLikeRunning,
    autoLikeDialogOpen,
    setAutoLikeDialogOpen,
    runAutoLike,
    clearAutoLikeRecords,
    onIntervalInput,
  };
}
