import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { httpGet, httpPost } from '@/lib/httpClient';
import {
  relativeTime,
  getAccountName,
} from '@/lib/gerrit/helpers';
import type {
  GerritChange,
  GerritDiffInfo,
  GerritCommentInfo,
  GerritFileInfo,
  GerritMessage,
  GerritRelatedChange,
  FileEntry,
} from '@/lib/gerrit/types';
import { DiffViewer, FileList } from './DiffViewer';
import { ChangeHeader } from './ChangeHeader';
import { PatchSelector, PARENT_PATCHSET_ID } from './PatchSelector';
import { RelationChain } from './RelationChain';
import { PeoplePanel } from './PeoplePanel';
import { ReviewDialog } from './ReviewDialog';
import { AiReviewWorkspace } from './AiReviewWorkspace';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassSearchInput } from '@/components/ui/glass-search-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUser } from '@/contexts/UserContext';
import type { AiReviewResult } from '@/lib/gerrit/ai-types';
import { RISK_LEVEL_META } from '@/lib/gerrit/ai-types';
import {
  AUTO_AI_STATE_EVENT,
  getAutoAiJobKey,
  getAutoAiResultCacheKey,
  hydrateAutoAiStateFromDisk,
  loadAutoAiJobs,
  loadAutoAiResultCache,
  setAutoAiJobs,
} from '@/lib/review/auto-ai';
import {
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { glassSectionClass } from '@/components/ui/glass';
import { LiquidTooltip } from '@/components/ui/liquid-tooltip';
import {
  buildCommitMessageDiff,
  COMMIT_MESSAGE_FILE_PATH,
  type CommitMessageCheckResponse,
  type CommitMessageTypoIssue,
} from '@/lib/review/commit-message';

function buildPendingLocalKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildPendingCommentsStorageKey(changeNumber: number, revisionId?: string): string {
  return `review-pending-comments:${changeNumber}:${revisionId || 'current'}`;
}

interface PendingDraftComment {
  localKey: string;
  line: number;
  message: string;
  in_reply_to?: string;
  unresolved?: boolean;
}

type PendingDraftMap = Record<string, PendingDraftComment[]>;

interface PendingDraftLocalSnapshot {
  comments: PendingDraftMap;
  updatedAt: string;
}

function parsePendingDraftStorage(raw: string | null): PendingDraftMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    if (parsed.comments && typeof parsed.comments === 'object') {
      return parsed.comments as PendingDraftMap;
    }
    return parsed as PendingDraftMap;
  } catch {
    return {};
  }
}

function clearPendingCommentsStorageForChange(changeNumber: number): void {
  if (typeof window === 'undefined') return;
  const prefix = `review-pending-comments:${changeNumber}:`;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore localStorage failures
  }
}

function classifySubmitSignal(text: string): 'merge-conflict' | 'not-current-rebase' | null {
  const normalized = text.toLowerCase();
  if (normalized.includes('merge conflict')) return 'merge-conflict';
  if (normalized.includes('not current') && normalized.includes('rebase possible')) return 'not-current-rebase';
  return null;
}

function extractApiErrorMessage(err: any): string {
  const raw = String(err?.message || '').trim();
  if (!raw) return 'Unknown error';

  const parts = raw.split('|');
  const tail = parts[parts.length - 1]?.trim();
  if (tail?.startsWith('{') && tail.endsWith('}')) {
    try {
      const parsed = JSON.parse(tail);
      if (parsed?.error) return String(parsed.error);
    } catch {
      // ignore
    }
  }

  return tail || raw;
}

interface MergeGuardState {
  ready: boolean;
  reasons: string[];
  hint: string;
  hasExternalPlusOne: boolean;
  hasExternalMinusOne: boolean;
  unresolvedCount: number;
}

function computeMergeGuard(change: GerritChange | null): MergeGuardState {
  if (!change) {
    return {
      ready: false,
      reasons: ['变更详情未加载完成'],
      hint: '变更详情未加载完成',
      hasExternalPlusOne: false,
      hasExternalMinusOne: false,
      unresolvedCount: 0,
    };
  }

  const unresolvedCount = Math.max(0, change.unresolved_comment_count || 0);
  const owner = change.owner;
  const ownerId = owner?._account_id;
  const ownerEmail = owner?.email?.trim().toLowerCase();
  const ownerName = getAccountName(owner).trim();

  const resolveName = (account: { name?: string; username?: string; email?: string } | undefined): string => {
    if (!account) return '';
    return (account.name || account.username || account.email || '').trim();
  };

  const normalizeReviewerKey = (account: { _account_id?: number; email?: string; name?: string; username?: string } | undefined): string => {
    if (!account) return '';
    if (typeof account._account_id === 'number') return `id:${account._account_id}`;
    if (account.email) return `email:${account.email.trim().toLowerCase()}`;
    const name = resolveName(account).toLowerCase();
    return name ? `name:${name}` : '';
  };

  const isOwner = (account: { _account_id?: number; email?: string; name?: string; username?: string } | undefined): boolean => {
    if (!account) return false;
    if (typeof ownerId === 'number' && typeof account._account_id === 'number' && account._account_id === ownerId) return true;
    const email = account.email?.trim().toLowerCase();
    if (ownerEmail && email && ownerEmail === email) return true;
    const name = resolveName(account);
    if (ownerName && name && ownerName === name) return true;
    return false;
  };

  const latestVotesByReviewer = new Map<string, number>();
  const messagesAsc = [...(change.messages || [])].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  for (const message of messagesAsc) {
    const author = message.author || message.real_author;
    if (!author || isOwner(author)) continue;
    const matched = String(message.message || '').match(/Code-Review([+-]\d)\b/i);
    if (!matched) continue;
    const vote = Number(matched[1]);
    if (!Number.isFinite(vote)) continue;
    const reviewerKey = normalizeReviewerKey(author);
    if (!reviewerKey) continue;
    latestVotesByReviewer.set(reviewerKey, vote);
  }

  const reviewerVotes = Array.from(latestVotesByReviewer.values());
  const hasExternalPlusOne = reviewerVotes.some((vote) => vote >= 1);
  const hasExternalMinusOne = reviewerVotes.some((vote) => vote <= -1);

  const reasons: string[] = [];
  if (unresolvedCount > 0) {
    reasons.push(`仍有 ${unresolvedCount} 条 unresolved 评论`);
  }
  if (!hasExternalPlusOne && hasExternalMinusOne) {
    reasons.push('存在 Reviewer 最新投票为 -1，且当前没有非提交者 +1/+2');
  }
  if (!hasExternalPlusOne) {
    reasons.push('当前没有非提交者 Code-Review +1/+2');
  }

  return {
    ready: reasons.length === 0,
    reasons,
    hint: reasons.length === 0 ? '满足合并前置条件，点击后仍需二次确认' : reasons[0],
    hasExternalPlusOne,
    hasExternalMinusOne,
    unresolvedCount,
  };
}

function waitForElement(selector: string, timeoutMs = 2500, intervalMs = 60): Promise<Element | null> {
  return new Promise((resolve) => {
    const start = Date.now();

    const tryFind = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }

      window.setTimeout(tryFind, intervalMs);
    };

    tryFind();
  });
}

const AI_REVIEW_RUNNING_TIMEOUT_MS = 10 * 60 * 1000;

interface ChangeDetailResponse {
  change: GerritChange;
  comments: Record<string, GerritCommentInfo[]>;
  files: Record<string, GerritFileInfo>;
  related: GerritRelatedChange[];
}

interface UnresolvedThreadTarget {
  rootId: string;
  path: string;
  line: number;
  patchSet: number | undefined;
  updated: string;
}

interface CommentLocatorEntry {
  rootId: string;
  latestId: string;
  path: string;
  line: number | undefined;
  patchSet: number | undefined;
  updated: string;
  message: string;
  authorName: string;
  participantNames: string[];
  unresolved: boolean;
}

interface PendingCommentJumpTarget {
  rootId?: string;
  path: string;
  line?: number;
  patchSet?: number;
  highlightTone: 'emerald' | 'blue';
}

function buildFileEntries(filesMap: Record<string, GerritFileInfo>): FileEntry[] {
  return Object.entries(filesMap || {})
    .map(([path, info]) => ({
      path,
      status: info.status || 'M',
      linesInserted: info.lines_inserted || 0,
      linesDeleted: info.lines_deleted || 0,
      binary: info.binary || false,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function buildDetailSnapshotSignature(detail: ChangeDetailResponse): string {
  const fileSignature = Object.entries(detail.files || {})
    .map(([path, info]) => [
      path,
      info.status || 'M',
      info.lines_inserted || 0,
      info.lines_deleted || 0,
      info.binary ? 1 : 0,
    ].join(':'))
    .sort()
    .join('|');

  const commentSignature = Object.entries(detail.comments || {})
    .map(([path, list]) => {
      const lastUpdated = (list || [])
        .map((comment) => String(comment.updated || comment.id || ''))
        .sort()
        .at(-1) || '';
      return `${path}:${list?.length || 0}:${lastUpdated}`;
    })
    .sort()
    .join('|');

  const relatedSignature = (detail.related || [])
    .map((item) => `${item._change_number}:${item._revision_number}:${item.status}:${item.change_id || ''}`)
    .sort()
    .join('|');

  const messageSignature = (detail.change.messages || [])
    .map((message) => `${message.id}:${message.date}:${message.tag || ''}`)
    .join('|');

  const currentRevisionId = detail.change.current_revision;
  const currentRevisionCommit =
    currentRevisionId && detail.change.revisions?.[currentRevisionId]
      ? detail.change.revisions[currentRevisionId].commit?.message
      : undefined;

  return JSON.stringify({
    id: detail.change.id,
    number: detail.change._number,
    status: detail.change.status,
    updated: detail.change.updated,
    currentRevision: currentRevisionId,
    selectedRevisionCommit: currentRevisionCommit,
    messages: messageSignature,
    files: fileSignature,
    comments: commentSignature,
    related: relatedSignature,
  });
}

interface ChangeDetailProps {
  changeNumber: number;
  gerritUrl: string;
  onBack: () => void;
}

export function ChangeDetail({ changeNumber, gerritUrl, onBack }: ChangeDetailProps) {
  const { user } = useUser();
  const [change, setChange] = useState<GerritChange | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [comments, setComments] = useState<Record<string, GerritCommentInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Diff state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentDiff, setCurrentDiff] = useState<GerritDiffInfo | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(undefined);
  const [baseRevisionId, setBaseRevisionId] = useState<string | undefined>(undefined);

  // Review state
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittingMerge, setSubmittingMerge] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [batchVoting, setBatchVoting] = useState<0 | 1 | 2>(0);
  const [batchMerging, setBatchMerging] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showCommentHistory, setShowCommentHistory] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [locatorQuery, setLocatorQuery] = useState('');
  const [locatorOnlyUnresolved, setLocatorOnlyUnresolved] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showAiReviewDialog, setShowAiReviewDialog] = useState(false);
  const [showMergeConfirmDialog, setShowMergeConfirmDialog] = useState(false);
  const [mergeDialogMode, setMergeDialogMode] = useState<'confirm' | 'warning'>('confirm');
  const [relatedChanges, setRelatedChanges] = useState<GerritRelatedChange[]>([]);
  const [selectedRelatedKeys, setSelectedRelatedKeys] = useState<Set<string>>(new Set());
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false);
  const [activeUnresolvedIndex, setActiveUnresolvedIndex] = useState(-1);
  const [expandedCommentThreadId, setExpandedCommentThreadId] = useState<string | null>(null);
  const [pendingCommentJump, setPendingCommentJump] = useState<PendingCommentJumpTarget | null>(null);
  const [aiReportCollapsed, setAiReportCollapsed] = useState(true);
  const [aiReportVersion, setAiReportVersion] = useState(0);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDetailRef = useRef<ChangeDetailResponse | null>(null);
  const detailSignatureRef = useRef<string | null>(null);
  const pendingJumpKeyRef = useRef<string | null>(null);
  const pendingDraftPersistTimerRef = useRef<number | null>(null);

  // Inline comments state (accumulated per file before submission)
  const [pendingComments, setPendingComments] = useState<PendingDraftMap>({});
  const [commitMessageTypos, setCommitMessageTypos] = useState<CommitMessageTypoIssue[]>([]);
  const [checkingCommitMessage, setCheckingCommitMessage] = useState(false);
  const commitMessageCheckCacheRef = useRef<Record<string, CommitMessageTypoIssue[]>>({});

  const pendingCommentsStorageKey = buildPendingCommentsStorageKey(
    changeNumber,
    selectedRevisionId || change?.current_revision
  );
  const effectiveBaseRevisionId = baseRevisionId === PARENT_PATCHSET_ID ? undefined : baseRevisionId;
  const compareMode = Boolean(
    selectedRevisionId &&
    baseRevisionId &&
    (baseRevisionId === PARENT_PATCHSET_ID || selectedRevisionId !== baseRevisionId)
  );

  const selectedRevisionCommitMessage = selectedRevisionId
    ? change?.revisions?.[selectedRevisionId]?.commit?.message
    : undefined;

  const commitMessageDiff = selectedRevisionCommitMessage
    ? buildCommitMessageDiff(selectedRevisionCommitMessage)
    : null;

  const commitMessageHighlightMap = commitMessageTypos.reduce<Record<number, { startColumn: number; endColumn: number; title?: string }[]>>((acc, item) => {
    const titleParts = [item.reason, item.suggestion ? `Suggest: ${item.suggestion}` : undefined].filter(Boolean);
    acc[item.line] = [
      ...(acc[item.line] || []),
      {
        startColumn: item.startColumn,
        endColumn: item.endColumn,
        title: titleParts.join(' | ') || 'Possible typo',
      },
    ];
    return acc;
  }, {});

  const displayFiles = useMemo<FileEntry[]>(() => {
    const commitMessageFile = selectedRevisionCommitMessage
      ? [{
          path: COMMIT_MESSAGE_FILE_PATH,
          status: 'M',
          linesInserted: selectedRevisionCommitMessage.split('\n').length,
          linesDeleted: 0,
          binary: false,
        }]
      : [];

    return [...commitMessageFile, ...files.filter((file) => file.path !== COMMIT_MESSAGE_FILE_PATH)];
  }, [files, selectedRevisionCommitMessage]);

  const aiReviewReport = useMemo<AiReviewResult | null>(() => {
    const cache = loadAutoAiResultCache() as Record<string, AiReviewResult>;
    const exactKey = getAutoAiResultCacheKey(
      changeNumber,
      selectedRevisionId,
      compareMode ? effectiveBaseRevisionId : undefined
    );
    const exactMatch = cache[exactKey];
    if (exactMatch) return exactMatch;

    const candidates = Object.values(cache)
      .filter((entry) => entry?.changeNumber === changeNumber)
      .sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));

    if (!candidates.length) return null;

    return (
      candidates.find((entry) => entry.revision === (selectedRevisionId || change?.current_revision)) ||
      candidates[0]
    );
  }, [aiReportVersion, change?.current_revision, changeNumber, compareMode, effectiveBaseRevisionId, selectedRevisionId]);

  const currentAiReviewJob = useMemo(() => {
    const revisionKey = selectedRevisionId || change?.current_revision || 'current';
    return loadAutoAiJobs()[getAutoAiJobKey(changeNumber, revisionKey)];
  }, [aiReportVersion, change?.current_revision, changeNumber, selectedRevisionId]);

  const aiReviewRunning = useMemo(() => {
    if (!currentAiReviewJob || currentAiReviewJob.status !== 'running') return false;
    const updatedAt = currentAiReviewJob.updatedAt || currentAiReviewJob.startedAt || currentAiReviewJob.createdAt;
    const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
    if (!Number.isFinite(updatedAtMs)) return false;
    return Date.now() - updatedAtMs < AI_REVIEW_RUNNING_TIMEOUT_MS;
  }, [currentAiReviewJob]);

  useEffect(() => {
    void hydrateAutoAiStateFromDisk();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAutoAiStateChange = () => {
      setAiReportVersion((prev) => prev + 1);
    };

    window.addEventListener(AUTO_AI_STATE_EVENT, handleAutoAiStateChange as EventListener);
    return () => {
      window.removeEventListener(AUTO_AI_STATE_EVENT, handleAutoAiStateChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!currentAiReviewJob || currentAiReviewJob.status !== 'running') return;

    const updatedAt = currentAiReviewJob.updatedAt || currentAiReviewJob.startedAt || currentAiReviewJob.createdAt;
    const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
    if (!Number.isFinite(updatedAtMs)) return;
    const remainingMs = AI_REVIEW_RUNNING_TIMEOUT_MS - (Date.now() - updatedAtMs);

    const markTimedOut = () => {
      setAutoAiJobs({
        ...loadAutoAiJobs(),
        [currentAiReviewJob.key]: {
          ...currentAiReviewJob,
          status: 'error',
          updatedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          error: currentAiReviewJob.error || 'AI review request timed out',
        },
      });
    };

    if (remainingMs <= 0) {
      markTimedOut();
      return;
    }

    const timeoutId = window.setTimeout(markTimedOut, remainingMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentAiReviewJob]);

  const applyDetailResponse = useCallback((res: ChangeDetailResponse) => {
    setChange(res.change);
    setComments(res.comments || {});
    setRelatedChanges(res.related || []);
    setFiles(buildFileEntries(res.files || {}));
    const nextCurrentRevisionId = res.change.current_revision;
    const revisionsAsc = Object.entries(res.change.revisions || {})
      .sort(([, a], [, b]) => a._number - b._number);
    const oldestRevisionId = revisionsAsc[0]?.[0];
    const currentRevision = nextCurrentRevisionId ? res.change.revisions?.[nextCurrentRevisionId] : undefined;

    setSelectedRevisionId((prev) => {
      if (prev && res.change.revisions?.[prev]) return prev;
      return nextCurrentRevisionId;
    });
    setBaseRevisionId((prev) => {
      if (prev === PARENT_PATCHSET_ID) {
        return PARENT_PATCHSET_ID;
      }
      if (prev && res.change.revisions?.[prev]) return prev;
      return PARENT_PATCHSET_ID;
    });
    detailSignatureRef.current = buildDetailSnapshotSignature(res);
    pendingDetailRef.current = null;
    setHasPendingUpdate(false);
  }, []);

  const fetchDetail = useCallback(async (options?: { silent?: boolean; backgroundCheck?: boolean }): Promise<boolean> => {
    const silent = options?.silent ?? false;
    const backgroundCheck = options?.backgroundCheck ?? false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await httpGet<ChangeDetailResponse>(
        '/api/gerrit/change-detail',
        {
          id: changeNumber,
          revision: selectedRevisionId,
          base: compareMode ? effectiveBaseRevisionId : undefined,
        }
      );
      const nextSignature = buildDetailSnapshotSignature(res);

      if (backgroundCheck) {
        if (detailSignatureRef.current && nextSignature !== detailSignatureRef.current) {
          pendingDetailRef.current = res;
          setHasPendingUpdate(true);
        }
        return true;
      }

      applyDetailResponse(res);
      return true;
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'Failed to load change detail');
      } else if (!backgroundCheck) {
        toast.error(err.message || 'Failed to refresh change detail');
      }
      return false;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [applyDetailResponse, changeNumber, compareMode, effectiveBaseRevisionId, selectedRevisionId]);

  useEffect(() => {
    pendingDetailRef.current = null;
    detailSignatureRef.current = null;
    setHasPendingUpdate(false);
    void fetchDetail();
    refreshIntervalRef.current = setInterval(() => {
      void fetchDetail({ silent: true, backgroundCheck: true });
    }, 60_000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [fetchDetail]);

  useEffect(() => {
    if (!change?.current_revision) return;
    if (!selectedRevisionId || !change.revisions?.[selectedRevisionId]) {
      setSelectedRevisionId(change.current_revision);
    }
  }, [change, selectedRevisionId]);

  useEffect(() => {
    if (!change?.revisions) return;
    if (
      !baseRevisionId ||
      (baseRevisionId !== PARENT_PATCHSET_ID && !change.revisions[baseRevisionId])
    ) {
      setBaseRevisionId(PARENT_PATCHSET_ID);
    }
  }, [baseRevisionId, change, selectedRevisionId]);

  useEffect(() => {
    if (!change?.revisions || !selectedRevisionId || !baseRevisionId) return;
    if (baseRevisionId === PARENT_PATCHSET_ID) return;
    const selectedRevision = change.revisions[selectedRevisionId];
    const baseRevision = change.revisions[baseRevisionId];
    if (!selectedRevision || !baseRevision) return;
    if (selectedRevision._number <= baseRevision._number) {
      const nextTargetId = Object.entries(change.revisions)
        .sort(([, a], [, b]) => a._number - b._number)
        .find(([, rev]) => rev._number > baseRevision._number)?.[0];
      if (nextTargetId) {
        setSelectedRevisionId(nextTargetId);
      }
    }
  }, [baseRevisionId, change, selectedRevisionId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const hydratePendingDrafts = async () => {
      let localRaw: string | null = null;
      try {
        localRaw = localStorage.getItem(pendingCommentsStorageKey);
      } catch {
        localRaw = null;
      }
      const localDrafts = parsePendingDraftStorage(localRaw);
      const hasLocalDrafts = Object.values(localDrafts).some((items) => Array.isArray(items) && items.length > 0);
      if (hasLocalDrafts) {
        if (!cancelled) setPendingComments(localDrafts);
        return;
      }

      try {
        const response = await fetch(`/api/gerrit/review-drafts-state?key=${encodeURIComponent(pendingCommentsStorageKey)}`);
        if (!response.ok) throw new Error('Failed to load review drafts');
        const payload = await response.json();
        const comments = (payload?.draft?.comments || {}) as PendingDraftMap;
        if (!cancelled) {
          setPendingComments(comments);
        }
        try {
          const snapshot: PendingDraftLocalSnapshot = {
            comments,
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem(pendingCommentsStorageKey, JSON.stringify(snapshot));
        } catch {
          // ignore localStorage failures
        }
      } catch {
        if (!cancelled) setPendingComments({});
      }
    };

    void hydratePendingDrafts();
    return () => {
      cancelled = true;
    };
  }, [pendingCommentsStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const snapshot: PendingDraftLocalSnapshot = {
        comments: pendingComments,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(pendingCommentsStorageKey, JSON.stringify(snapshot));
    } catch {
      // ignore localStorage failures
    }

    if (pendingDraftPersistTimerRef.current) {
      window.clearTimeout(pendingDraftPersistTimerRef.current);
    }
    pendingDraftPersistTimerRef.current = window.setTimeout(() => {
      pendingDraftPersistTimerRef.current = null;
      void fetch('/api/gerrit/review-drafts-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: pendingCommentsStorageKey,
          changeNumber,
          revisionId: selectedRevisionId || change?.current_revision,
          comments: pendingComments,
        }),
      }).catch(() => {
        // keep local snapshot even if disk sync fails
      });
    }, 150);
  }, [change?.current_revision, changeNumber, pendingComments, pendingCommentsStorageKey, selectedRevisionId]);

  useEffect(() => {
    return () => {
      if (pendingDraftPersistTimerRef.current) {
        window.clearTimeout(pendingDraftPersistTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const defaults = new Set(
      relatedChanges
        .filter((c) => c.status === 'NEW')
        .map((c) => `${c._change_number}:${c._revision_number}`)
    );
    setSelectedRelatedKeys(defaults);
  }, [relatedChanges]);

  useEffect(() => {
    const message = selectedRevisionCommitMessage || '';
    const cacheKey = `${changeNumber}:${selectedRevisionId || 'current'}:${message}`;
    if (!message.trim()) {
      setCommitMessageTypos([]);
      setCheckingCommitMessage(false);
      return;
    }

    if (commitMessageCheckCacheRef.current[cacheKey]) {
      setCommitMessageTypos(commitMessageCheckCacheRef.current[cacheKey]);
      setCheckingCommitMessage(false);
      return;
    }

    let cancelled = false;
    setCheckingCommitMessage(true);
    httpPost<CommitMessageCheckResponse>('/api/gerrit/commit-message-check', { message })
      .then((response) => {
        if (cancelled) return;
        const issues = response.issues || [];
        commitMessageCheckCacheRef.current[cacheKey] = issues;
        setCommitMessageTypos(issues);
      })
      .catch(() => {
        if (cancelled) return;
        setCommitMessageTypos([]);
      })
      .finally(() => {
        if (!cancelled) setCheckingCommitMessage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [changeNumber, selectedRevisionCommitMessage, selectedRevisionId]);

  const resolveFilePath = useCallback((rawPath: string): string | null => {
    if (!rawPath) return null;
    const normalized = rawPath.replace(/^([ab]\/)+/, '').trim();
    const exact = files.find((f) => f.path === rawPath || f.path === normalized)?.path;
    if (exact) return exact;
    const bySuffix = files.find((f) => f.path.endsWith(`/${normalized}`) || f.path.endsWith(normalized))?.path;
    return bySuffix || null;
  }, [files]);

  const loadDiffForFile = useCallback(async (path: string) => {
    setLoadingDiff(true);
    try {
      if (path === COMMIT_MESSAGE_FILE_PATH) {
        setCurrentDiff(selectedRevisionCommitMessage ? buildCommitMessageDiff(selectedRevisionCommitMessage) : null);
        return true;
      }
      const diff = await httpGet<GerritDiffInfo>('/api/gerrit/diff', {
        id: changeNumber,
        file: path,
        revision: selectedRevisionId,
        base: compareMode ? effectiveBaseRevisionId : undefined,
      });
      setCurrentDiff(diff);
      return true;
    } catch {
      setCurrentDiff(null);
      return false;
    } finally {
      setLoadingDiff(false);
    }
  }, [changeNumber, compareMode, effectiveBaseRevisionId, selectedRevisionCommitMessage, selectedRevisionId]);

  // Load diff when file is selected
  const handleSelectFile = useCallback(async (path: string) => {
    if (selectedFile === path) {
      setSelectedFile(null);
      setCurrentDiff(null);
      return;
    }

    setSelectedFile(path);
    await loadDiffForFile(path);
  }, [loadDiffForFile, selectedFile]);

  const ensureFileOpen = useCallback(async (rawPath: string, options?: { silentNotFound?: boolean }) => {
    const resolvedPath = resolveFilePath(rawPath);
    if (!resolvedPath) {
      if (!options?.silentNotFound) {
        toast.error(`File not found: ${rawPath}`);
      }
      return null;
    }

    if (selectedFile !== resolvedPath) {
      setSelectedFile(resolvedPath);
      await loadDiffForFile(resolvedPath);
    } else if (!currentDiff) {
      await loadDiffForFile(resolvedPath);
    }

    return resolvedPath;
  }, [currentDiff, loadDiffForFile, resolveFilePath, selectedFile]);

  const appendPendingComment = useCallback((filePath: string, comment: { localKey: string; line: number; message: string; in_reply_to?: string; unresolved?: boolean }) => {
    setPendingComments((prev) => ({
      ...prev,
      [filePath]: [...(prev[filePath] || []), comment],
    }));
  }, []);

  const upsertPendingReplyForFile = useCallback(
    (filePath: string, commentId: string, line: number | undefined, message: string, unresolved?: boolean) => {
      setPendingComments((prev) => {
        const existing = prev[filePath] || [];
        const filtered = existing.filter((item) => item.in_reply_to !== commentId);
        const nextComment: {
          localKey: string;
          line: number;
          message: string;
          in_reply_to?: string;
          unresolved?: boolean;
        } = {
          localKey: buildPendingLocalKey(unresolved === false ? 'resolve' : 'reply'),
          line: typeof line === 'number' ? line : 0,
          message,
          in_reply_to: commentId,
        };
        if (typeof unresolved === 'boolean') {
          nextComment.unresolved = unresolved;
        }
        return {
          ...prev,
          [filePath]: [...filtered, nextComment],
        };
      });
    },
    []
  );

  // Add inline comment to pending list
  const handleAddInlineComment = useCallback((line: number, message: string) => {
    if (!selectedFile) return;
    appendPendingComment(selectedFile, { localKey: buildPendingLocalKey('inline'), line, message, unresolved: true });
    toast.success(`Comment added on line ${line} (pending submission)`);
  }, [appendPendingComment, selectedFile]);

  const handleAddCommitMessageComment = useCallback((line: number, message: string) => {
    appendPendingComment(COMMIT_MESSAGE_FILE_PATH, { localKey: buildPendingLocalKey('commit-msg'), line, message, unresolved: true });
    toast.success(`Commit message comment added on line ${line}`);
  }, [appendPendingComment]);

  // Reply to an existing comment (adds as pending with in_reply_to)
  const handleReplyCommentForFile = useCallback(async (filePath: string, commentId: string, line: number | undefined, message: string, unresolved?: boolean) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    if (unresolved === false) {
      upsertPendingReplyForFile(filePath, commentId, line, trimmed, false);
      setExpandedCommentThreadId(null);
      toast.success('Resolved reply saved to drafts. It will be submitted with Review.');
      return;
    }

    upsertPendingReplyForFile(filePath, commentId, line, trimmed, unresolved);
    toast.success('Reply added (pending submission)');
  }, [upsertPendingReplyForFile]);

  const handleReplyComment = useCallback(async (commentId: string, line: number | undefined, message: string, unresolved?: boolean) => {
    if (!selectedFile) return;
    await handleReplyCommentForFile(selectedFile, commentId, line, message, unresolved);
  }, [handleReplyCommentForFile, selectedFile]);

  const handleReplyCommitMessageComment = useCallback(async (commentId: string, line: number | undefined, message: string, unresolved?: boolean) => {
    await handleReplyCommentForFile(COMMIT_MESSAGE_FILE_PATH, commentId, line, message, unresolved);
  }, [handleReplyCommentForFile]);

  // Edit a pending comment/reply
  const handleEditPendingComment = useCallback((file: string, localKey: string, newMessage: string, unresolved?: boolean) => {
    setPendingComments((prev) => {
      const existing = prev[file] || [];
      const idx = existing.findIndex((c) => c.localKey === localKey);
      if (idx === -1) return prev;
      
      const nextList = [...existing];
      nextList[idx] = { ...nextList[idx], message: newMessage };
      if (unresolved !== undefined) {
        nextList[idx].unresolved = unresolved;
      }
      
      return { ...prev, [file]: nextList };
    });
    toast.success('Draft updated');
  }, []);

  const handleResolveInlineCommentForFile = useCallback(async (filePath: string, commentId: string, line: number | undefined) => {
    upsertPendingReplyForFile(filePath, commentId, line, 'Done', false);
    setExpandedCommentThreadId(null);
    toast.success('Marked as resolved in drafts. It will be submitted with Review.');
  }, [upsertPendingReplyForFile]);

  const handleResolveInlineComment = useCallback(async (commentId: string, line: number | undefined) => {
    if (!selectedFile) return;
    await handleResolveInlineCommentForFile(selectedFile, commentId, line);
  }, [handleResolveInlineCommentForFile, selectedFile]);

  const handleResolveCommitMessageComment = useCallback(async (commentId: string, line: number | undefined) => {
    await handleResolveInlineCommentForFile(COMMIT_MESSAGE_FILE_PATH, commentId, line);
  }, [handleResolveInlineCommentForFile]);

  // Add draft comment from AI issue card
  const handleAddAiDraftComment = useCallback((file: string, line: number, message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const resolvedFile = resolveFilePath(file);
    if (!resolvedFile) {
      toast.error(`File not found: ${file}`);
      return;
    }

    const localKey = buildPendingLocalKey('ai');

    // Check for duplicates before updating state to avoid side-effects inside setState
    const existing = pendingComments[resolvedFile] || [];
    const duplicated = existing.some((c) => c.line === line && c.message.trim() === trimmed && !c.in_reply_to);
    if (duplicated) {
      toast.info('该 AI 建议已在草稿中');
      return;
    }

    setPendingComments((prev) => ({
      ...prev,
      [resolvedFile]: [...(prev[resolvedFile] || []), { localKey, line, message: trimmed }],
    }));

    ensureFileOpen(resolvedFile).then((openedFile) => {
      if (!openedFile) return;
      setTimeout(() => {
        const lineEl = document.querySelector(`[data-diff-line="${openedFile}:${line}"]`);
        if (lineEl) {
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 220);
    });

    toast.success(`AI 建议已添加到草稿: ${resolvedFile}:${line}`, {
      action: {
        label: '撤销',
        onClick: () => {
          setPendingComments((prev) => {
            const existing = prev[resolvedFile] || [];
            const nextList = existing.filter((c) => c.localKey !== localKey);
            if (nextList.length === existing.length) return prev;
            const next = { ...prev };
            if (nextList.length === 0) {
              delete next[resolvedFile];
            } else {
              next[resolvedFile] = nextList;
            }
            return next;
          });
        },
      },
    });
  }, [ensureFileOpen, pendingComments, resolveFilePath]);

  const handleDeletePendingComment = useCallback((file: string, localKey: string) => {
    setPendingComments((prev) => {
      const existing = prev[file] || [];
      const nextList = existing.filter((c) => c.localKey !== localKey);
      if (nextList.length === existing.length) return prev;
      const next = { ...prev };
      if (nextList.length === 0) {
        delete next[file];
      } else {
        next[file] = nextList;
      }
      return next;
    });
    toast.success('Draft comment deleted');
  }, []);

  // Search across all file diffs
  const handleSearchFile = useCallback(async (query: string) => {
    const keyword = query.trim();
    if (!keyword) return;

    if ((selectedRevisionCommitMessage || '').includes(keyword)) {
      setSelectedFile(COMMIT_MESSAGE_FILE_PATH);
      setCurrentDiff(buildCommitMessageDiff(selectedRevisionCommitMessage || ''));
      return;
    }

    // Search through all files by loading their diffs one by one
    for (const file of displayFiles) {
      if (file.path === COMMIT_MESSAGE_FILE_PATH) continue;
      if (file.binary) continue;
      try {
          const diff = await httpGet<GerritDiffInfo>('/api/gerrit/diff', {
            id: changeNumber,
            file: file.path,
            revision: selectedRevisionId,
            base: compareMode ? effectiveBaseRevisionId : undefined,
          });
        // Check if any content contains the search query
        const found = diff.content?.some((chunk: any) =>
          (chunk.ab || []).some((l: string) => l.includes(keyword)) ||
          (chunk.a || []).some((l: string) => l.includes(keyword)) ||
          (chunk.b || []).some((l: string) => l.includes(keyword))
        );
        if (found) {
          // Expand this file
          setSelectedFile(file.path);
          setCurrentDiff(diff);
          toast.success(`Found match in ${file.path}`);
          return;
        }
      } catch {
        // Skip files that fail to load
      }
    }
    toast.error(`No matches found for "${keyword}"`);
  }, [changeNumber, compareMode, displayFiles, effectiveBaseRevisionId, selectedRevisionCommitMessage, selectedRevisionId]);

  // Submit review (includes pending inline comments)
  const handleSubmitReview = useCallback(async (data: { message: string; labels: Record<string, number> }) => {
    setSubmittingReview(true);
    try {
      // Convert pending comments to Gerrit format
      const commentsPayload: Record<string, { line?: number; message: string; in_reply_to?: string; unresolved?: boolean }[]> = {};
      for (const [file, fileComments] of Object.entries(pendingComments)) {
        commentsPayload[file] = fileComments.map((c) => {
          const entry: { line?: number; message: string; in_reply_to?: string; unresolved?: boolean } = { message: c.message };
          if (c.line) entry.line = c.line;
          if (c.in_reply_to) entry.in_reply_to = c.in_reply_to;
          if (typeof c.unresolved === 'boolean') entry.unresolved = c.unresolved;
          return entry;
        });
      }

      await httpPost('/api/gerrit/review', {
        changeId: changeNumber,
        revisionId: selectedRevisionId || 'current',
        message: data.message,
        labels: data.labels,
        comments: Object.keys(commentsPayload).length > 0 ? commentsPayload : undefined,
      });
      toast.success('Review submitted successfully');
      setPendingComments({});
      clearPendingCommentsStorageForChange(changeNumber);
      void fetch(`/api/gerrit/review-drafts-state?changeNumber=${changeNumber}`, {
        method: 'DELETE',
      }).catch(() => {});
      
      // Small delay to ensure Gerrit has processed the comments before refreshing
      setTimeout(() => {
        void fetchDetail({ silent: true });
      }, 500);
    } catch (err: any) {
      toast.error('Submission failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmittingReview(false);
    }
  }, [changeNumber, fetchDetail, pendingComments, selectedRevisionId]);

  const handleTriggerInternalAgent = useCallback(async (message: string) => {
    if (!message.trim()) return;
    setSubmittingReview(true);
    try {
      await httpPost('/api/gerrit/review', {
        changeId: changeNumber,
        revisionId: selectedRevisionId || 'current',
        message,
      });
      toast.success('内部 Agent 触发评论已发送');
      
      // Small delay to ensure Gerrit has processed the comment before refreshing
      setTimeout(() => {
        void fetchDetail({ silent: true });
      }, 500);
    } catch (err: any) {
      toast.error('触发失败：' + (err.message || '未知错误'));
    } finally {
      setSubmittingReview(false);
    }
  }, [changeNumber, fetchDetail, selectedRevisionId]);

  const handleSubmitMerge = useCallback(() => {
    const guard = computeMergeGuard(change || null);
    if (!guard.ready) {
      setMergeDialogMode('warning');
      setShowMergeConfirmDialog(true);
      return;
    }
    setMergeDialogMode('confirm');
    setShowMergeConfirmDialog(true);
  }, [change]);

  const handleConfirmMerge = useCallback(async () => {
    setShowMergeConfirmDialog(false);
    setSubmittingMerge(true);
    setMergeError(null);
    try {
      await httpPost('/api/gerrit/submit', {
        changeId: changeNumber,
        revisionId: selectedRevisionId || 'current',
      });
      toast.success('Change submitted (merged)');
      void fetchDetail({ silent: true });
    } catch (err: any) {
      const message = extractApiErrorMessage(err);
      setMergeError(message);
      const signal = classifySubmitSignal(message);
      if (signal === 'merge-conflict') {
        toast.error('Submit failed: Merge Conflict (please resolve conflicts)');
      } else if (signal === 'not-current-rebase') {
        toast.error('Submit failed: Not current (please rebase)');
      } else {
        toast.error(`Submit failed: ${message}`);
      }
    } finally {
      setSubmittingMerge(false);
    }
  }, [changeNumber, fetchDetail, selectedRevisionId]);

  const handleBatchVote = useCallback(async (score: 1 | 2) => {
    const targets = relatedChanges.filter((c) => selectedRelatedKeys.has(`${c._change_number}:${c._revision_number}`));
    const newTargets = targets.filter((c) => c.status === 'NEW');
    if (targets.length === 0) {
      toast.info('Please select changes from Relation chain first');
      return;
    }
    if (newTargets.length === 0) {
      toast.info('No voteable NEW changes in selection');
      return;
    }
    const codeReviewLabel = change?.labels?.['Code-Review'] ? 'Code-Review' : 'Label-Code-Review';
    setBatchVoting(score);
    let success = 0;
    const failed: number[] = [];
    for (const target of newTargets) {
      try {
        await httpPost('/api/gerrit/review', {
          changeId: target._change_number,
          revisionId: target._revision_number || 'current',
          labels: { [codeReviewLabel]: score },
          message: `Batch vote from relation chain: +${score}`,
        });
        success += 1;
      } catch {
        failed.push(target._change_number);
      }
    }
    setBatchVoting(0);
    if (failed.length === 0) {
      toast.success(`Batch +${score} successful: ${success}/${newTargets.length}`);
    } else {
      toast.error(`Batch +${score} partially failed: ${success} ok, ${failed.join(', ')} failed`);
    }
    void fetchDetail({ silent: true });
  }, [change?.labels, fetchDetail, relatedChanges, selectedRelatedKeys]);

  const handleBatchMerge = useCallback(async () => {
    const targets = relatedChanges.filter((c) => selectedRelatedKeys.has(`${c._change_number}:${c._revision_number}`));
    const newTargets = targets.filter((c) => c.status === 'NEW');
    if (targets.length === 0) {
      toast.info('Please select changes from Relation chain first');
      return;
    }
    if (newTargets.length === 0) {
      toast.info('No submittable NEW changes in selection');
      return;
    }
    setBatchMerging(true);
    let success = 0;
    const failed: number[] = [];
    for (const target of newTargets) {
      try {
        await httpPost('/api/gerrit/submit', {
          changeId: target._change_number,
          revisionId: target._revision_number || 'current',
          labels: {},
        });
        success += 1;
      } catch {
        failed.push(target._change_number);
      }
    }
    setBatchMerging(false);
    if (failed.length === 0) {
      toast.success(`Batch Merge successful: ${success}/${newTargets.length}`);
    } else {
      toast.error(`Batch Merge partially failed: ${success} ok, ${failed.join(', ')} failed`);
    }
    void fetchDetail({ silent: true });
  }, [fetchDetail, relatedChanges, selectedRelatedKeys]);

  const jumpToDiffLine = useCallback((file: string, line: number) => {
    setPendingCommentJump({
      path: file,
      line,
      highlightTone: 'blue',
    });
  }, []);

  useEffect(() => {
    if (!pendingCommentJump) return;
    if (loading) return;

    const jumpKey = [
      pendingCommentJump.rootId || '',
      pendingCommentJump.path || '',
      String(pendingCommentJump.line || ''),
      String(pendingCommentJump.patchSet || ''),
    ].join('|');
    if (pendingJumpKeyRef.current === jumpKey) return;
    pendingJumpKeyRef.current = jumpKey;

    const desiredRevisionId = pendingCommentJump.patchSet
      ? Object.entries(change?.revisions || {}).find(([, rev]) => rev._number === pendingCommentJump.patchSet)?.[0]
      : undefined;

    if (desiredRevisionId && desiredRevisionId !== selectedRevisionId) {
      setSelectedRevisionId(desiredRevisionId);
      pendingJumpKeyRef.current = null;
      return;
    }

    if (pendingCommentJump.patchSet && !desiredRevisionId) {
      pendingJumpKeyRef.current = null;
      setPendingCommentJump(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const openedFile = await ensureFileOpen(pendingCommentJump.path, { silentNotFound: true });
      if (!openedFile || cancelled) {
        pendingJumpKeyRef.current = null;
        if (!cancelled) {
          setPendingCommentJump(null);
        }
        return;
      }

      if (pendingCommentJump.rootId) {
        const threadSelector = `[data-comment-thread="${pendingCommentJump.rootId}"]`;
        const threadEl = await waitForElement(threadSelector, 3200);
        if (threadEl && !cancelled) {
          threadEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          threadEl.classList.add('ring-2', 'ring-amber-400', 'ring-offset-1');
          window.setTimeout(() => threadEl.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-1'), 2500);
          pendingJumpKeyRef.current = null;
          setPendingCommentJump(null);
          return;
        }
      }

      if (!pendingCommentJump.line) {
        pendingJumpKeyRef.current = null;
        setPendingCommentJump(null);
        return;
      }

      const lineSelector = `[data-diff-line="${openedFile}:${pendingCommentJump.line}"]`;
      const lineEl = await waitForElement(lineSelector, 3200);
      if (!lineEl || cancelled) {
        pendingJumpKeyRef.current = null;
        setPendingCommentJump(null);
        return;
      }

      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const lineRingColor = pendingCommentJump.highlightTone === 'emerald' ? 'ring-emerald-400' : 'ring-blue-400';
      lineEl.classList.add('ring-2', lineRingColor, 'ring-offset-1');
      window.setTimeout(() => lineEl.classList.remove('ring-2', lineRingColor, 'ring-offset-1'), 2500);

      if (!cancelled) {
        pendingJumpKeyRef.current = null;
        setPendingCommentJump(null);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [change?.revisions, ensureFileOpen, loading, pendingCommentJump, selectedRevisionId]);

  // Add reviewer or CC (accepts GerritAccount from search)
  const handleAddReviewer = useCallback(async (account: { _account_id: number; email?: string; name?: string }, state: 'REVIEWER' | 'CC') => {
    const identifier = account._account_id ? String(account._account_id) : account.email;
    if (!identifier) return;
    try {
      await httpPost(`/api/gerrit/reviewers?changeId=${changeNumber}`, { reviewer: identifier, state });
      toast.success(`Added ${state === 'CC' ? 'CC' : 'Reviewer'}: ${account.name || account.email || identifier}`);
      void fetchDetail({ silent: true });
    } catch (err: any) {
      toast.error('Failed to add: ' + (err.message || 'Unknown error'));
    }
  }, [changeNumber, fetchDetail]);

  // Remove reviewer
  const handleRemoveReviewer = useCallback(async (accountId: number) => {
    try {
      await httpPost(`/api/gerrit/reviewers?changeId=${changeNumber}`, { accountId, _method: 'DELETE' });
      toast.success('Removed');
      void fetchDetail({ silent: true });
    } catch (err: any) {
      toast.error('Failed to remove: ' + (err.message || 'Unknown error'));
    }
  }, [changeNumber, fetchDetail]);

  const handleApplyPendingUpdate = useCallback(async () => {
    if (pendingDetailRef.current) {
      applyDetailResponse(pendingDetailRef.current);
      toast.success('已刷新到最新提交详情');
      return;
    }
    await fetchDetail({ silent: true });
    toast.success('已刷新到最新提交详情');
  }, [applyDetailResponse, fetchDetail]);

  const commentLocatorEntries = useMemo<CommentLocatorEntry[]>(() => {
    const result: CommentLocatorEntry[] = [];

    for (const [path, fileComments] of Object.entries(comments || {})) {
      const commentsById = new Map<string, GerritCommentInfo>();
      for (const comment of fileComments || []) {
        commentsById.set(comment.id, comment);
      }

      const resolveRootId = (commentId: string): string => {
        let rootId = commentId;
        let cursor = commentsById.get(commentId);
        const seen = new Set<string>();
        while (cursor?.in_reply_to && commentsById.has(cursor.in_reply_to) && !seen.has(cursor.in_reply_to)) {
          seen.add(cursor.in_reply_to);
          rootId = cursor.in_reply_to;
          cursor = commentsById.get(cursor.in_reply_to);
        }
        return rootId;
      };

      const threadsByRoot = new Map<string, GerritCommentInfo[]>();
      for (const comment of fileComments || []) {
        const rootId = resolveRootId(comment.id);
        const thread = threadsByRoot.get(rootId) || [];
        thread.push(comment);
        threadsByRoot.set(rootId, thread);
      }

      const pendingForFile = pendingComments[path] || [];

      for (const [rootId, thread] of threadsByRoot.entries()) {
        const root = commentsById.get(rootId) || thread[0];
        const sorted = [...thread].sort((a, b) => String(a.updated || '').localeCompare(String(b.updated || '')));
        const latest = sorted[sorted.length - 1] || root;
        let unresolved = typeof latest.unresolved === 'boolean' ? latest.unresolved : !!root?.unresolved;

        for (const draft of pendingForFile) {
          if (!draft.in_reply_to || typeof draft.unresolved !== 'boolean') continue;
          if (resolveRootId(draft.in_reply_to) === rootId) {
            unresolved = draft.unresolved;
          }
        }

        result.push({
          rootId,
          latestId: latest.id,
          path,
          line: root?.line ?? latest?.line,
          patchSet: root?.patch_set || latest.patch_set,
          updated: latest.updated || root?.updated || '',
          message: latest.message || root?.message || '',
          authorName: getAccountName(latest.author || root?.author),
          participantNames: Array.from(
            new Set(
              sorted
                .map((entry) => getAccountName(entry.author))
                .filter((name) => Boolean(name && name.trim()))
            )
          ),
          unresolved,
        });
      }
    }

    return result.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
  }, [comments, pendingComments]);

  const scopedHistoryMessages = useMemo(() => {
    const messages = change?.messages || [];
    if (!change?.revisions || !selectedRevisionId) {
      return [...messages].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    }

    const selectedPatchsetNumber = change.revisions[selectedRevisionId]?._number;
    if (!selectedPatchsetNumber) {
      return [...messages].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    }

    const basePatchsetNumber = effectiveBaseRevisionId && change.revisions[effectiveBaseRevisionId]
      ? change.revisions[effectiveBaseRevisionId]._number
      : 0;

    return messages
      .filter((msg) => {
        const revisionNumber = msg._revision_number;
        if (typeof revisionNumber !== 'number') return false;
        return revisionNumber > basePatchsetNumber && revisionNumber <= selectedPatchsetNumber;
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [change?.messages, change?.revisions, effectiveBaseRevisionId, selectedRevisionId]);

  const filteredMessages = useMemo(() => {
    const keyword = historyQuery.trim().toLowerCase();
    if (!keyword) return scopedHistoryMessages;
    return scopedHistoryMessages.filter((msg) => {
      const author = getAccountName(msg.author || msg.real_author).toLowerCase();
      const messageText = String(msg.message || '').toLowerCase();
      const tag = String(msg.tag || '').toLowerCase();
      const patch = String(msg._revision_number || '').toLowerCase();
      return (
        author.includes(keyword) ||
        messageText.includes(keyword) ||
        tag.includes(keyword) ||
        patch.includes(keyword)
      );
    });
  }, [historyQuery, scopedHistoryMessages]);

  const filteredCommentEntries = useMemo(() => {
    const keyword = locatorQuery.trim().toLowerCase();
    return commentLocatorEntries.filter((entry) => {
      if (locatorOnlyUnresolved && !entry.unresolved) return false;
      if (!keyword) return true;
      return (
        String(entry.path || '').toLowerCase().includes(keyword) ||
        String(entry.message || '').toLowerCase().includes(keyword) ||
        String(entry.line || '').toLowerCase().includes(keyword) ||
        String(entry.authorName || '').toLowerCase().includes(keyword) ||
        entry.participantNames.some((name) => name.toLowerCase().includes(keyword))
      );
    });
  }, [commentLocatorEntries, locatorOnlyUnresolved, locatorQuery]);

  const unresolvedCommentCount = useMemo(() => (
    commentLocatorEntries.reduce((sum, entry) => sum + (entry.unresolved ? 1 : 0), 0)
  ), [commentLocatorEntries]);

  const autogeneratedMessageCount = useMemo(() => (
    scopedHistoryMessages.reduce((sum, msg) => sum + (msg.tag?.startsWith('autogenerated:') ? 1 : 0), 0)
  ), [scopedHistoryMessages]);

  const mergeGuard = useMemo(() => computeMergeGuard(change), [change]);

  const unresolvedThreadTargets = useMemo<UnresolvedThreadTarget[]>(() => {
    return commentLocatorEntries
      .filter((entry) => entry.unresolved && typeof entry.line === 'number')
      .map((entry) => ({
        rootId: entry.rootId,
        path: entry.path,
        line: entry.line as number,
        patchSet: entry.patchSet,
        updated: entry.updated,
      }))
      .sort((a, b) => {
        const patchDiff = (a.patchSet || 0) - (b.patchSet || 0);
        if (patchDiff !== 0) return patchDiff;
        const pathDiff = a.path.localeCompare(b.path);
        if (pathDiff !== 0) return pathDiff;
        return a.line - b.line;
      });
  }, [commentLocatorEntries]);

  useEffect(() => {
    if (unresolvedThreadTargets.length === 0) {
      setActiveUnresolvedIndex(-1);
      return;
    }
    setActiveUnresolvedIndex((prev) => {
      if (prev < 0) return -1;
      return prev % unresolvedThreadTargets.length;
    });
  }, [unresolvedThreadTargets]);

  const handleJumpToNextUnresolved = useCallback(() => {
    if (unresolvedThreadTargets.length === 0) {
      toast.info('No unresolved comments');
      return;
    }
    const nextIndex = (activeUnresolvedIndex + 1 + unresolvedThreadTargets.length) % unresolvedThreadTargets.length;
    const target = unresolvedThreadTargets[nextIndex];
    setActiveUnresolvedIndex(nextIndex);
    setExpandedCommentThreadId(target.rootId);
    setPendingCommentJump({
      rootId: target.rootId,
      path: target.path,
      line: target.line,
      patchSet: target.patchSet,
      highlightTone: 'emerald',
    });
  }, [activeUnresolvedIndex, unresolvedThreadTargets]);

  useEffect(() => {
    if (!pendingCommentJump) {
      pendingJumpKeyRef.current = null;
    }
  }, [pendingCommentJump]);

  if (loading) {
    return (
      <div className={cn('mx-auto flex max-w-xl items-center justify-center gap-2 rounded-2xl px-5 py-10 text-sm text-muted-foreground', glassSectionClass)}>
        <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
        <span>Loading change details...</span>
      </div>
    );
  }

  if (error || !change) {
    return (
      <div className={cn('mx-auto max-w-xl space-y-3 rounded-2xl px-5 py-10 text-center', glassSectionClass)}>
        <p className="text-sm text-red-600">{error || 'Change not found'}</p>
        <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
      </div>
    );
  }

  const totalInsertions = files.reduce((sum, f) => sum + (f.linesInserted || 0), 0);
  const totalDeletions = files.reduce((sum, f) => sum + (f.linesDeleted || 0), 0);

  // Only keep Code-Review for submit panel
  const availableLabels = (change.labels ? Object.keys(change.labels) : ['Code-Review'])
    .filter((label) => label === 'Code-Review' || label === 'Label-Code-Review');
  const currentCodeReviewLabel = availableLabels[0];
  const currentCodeReviewScore = currentCodeReviewLabel
    ? change.labels?.[currentCodeReviewLabel]?.all?.find((approval) => {
        const approvalEmail = approval.email?.trim().toLowerCase();
        const approvalName = approval.name?.trim();
        const userEmail = user?.primaryEmail?.trim().toLowerCase();
        const userRealName = user?.realName?.trim();
        const userName = user?.userName?.trim();

        if (approvalEmail && userEmail && approvalEmail === userEmail) return true;
        if (approvalName && userRealName && approvalName === userRealName) return true;
        if (approvalName && userName && approvalName === userName) return true;
        return false;
      })?.value
    : undefined;
  const initialReviewScores = currentCodeReviewLabel && typeof currentCodeReviewScore === 'number'
    ? { [currentCodeReviewLabel]: currentCodeReviewScore }
    : {};

  const revisionsDesc = Object.entries(change.revisions || {})
    .sort(([, a], [, b]) => b._number - a._number);

  const selectedRevisionNumber = selectedRevisionId && change.revisions?.[selectedRevisionId]
    ? change.revisions[selectedRevisionId]._number
    : undefined;
  const baseRevisionNumber = effectiveBaseRevisionId && change.revisions?.[effectiveBaseRevisionId]
    ? change.revisions[effectiveBaseRevisionId]._number
    : undefined;

  const codeReviewPermissions =
    change.permitted_labels?.['Code-Review'] ||
    change.permitted_labels?.['Label-Code-Review'] ||
    [];
  const canVotePlusTwo = codeReviewPermissions.includes('+2');
  const canVotePlusOne = codeReviewPermissions.includes('+1') || canVotePlusTwo;
  const canShowMerge = canVotePlusTwo && change.status === 'NEW';

  const latestSubmitSignalFromHistory = (change.messages || [])
    .map((msg) => classifySubmitSignal(msg.message || ''))
    .filter((s): s is 'merge-conflict' | 'not-current-rebase' => !!s)
    .at(-1);

  const revisionCommentCounts = revisionsDesc.reduce<Record<string, number>>((acc, [id, rev]) => {
    const patchSetNumber = rev._number;
    let count = 0;
    for (const fileComments of Object.values(comments || {})) {
      for (const comment of fileComments || []) {
        if (comment.patch_set === patchSetNumber) count += 1;
      }
    }
    acc[id] = count;
    return acc;
  }, {});

  // Get file-specific comments for selected file
  const fileComments = selectedFile ? (comments[selectedFile] || []) : [];
  const commitMessageComments = comments[COMMIT_MESSAGE_FILE_PATH] || [];
  const commitMessagePendingComments = pendingComments[COMMIT_MESSAGE_FILE_PATH] || [];

  const relatedSelectableTotal = relatedChanges.length;
  const relatedSelectedTotal = relatedChanges.filter((c) => selectedRelatedKeys.has(`${c._change_number}:${c._revision_number}`)).length;
  const relatedAllChecked = relatedSelectableTotal > 0 && relatedSelectedTotal === relatedSelectableTotal;
  const relatedSomeChecked = relatedSelectedTotal > 0 && relatedSelectedTotal < relatedSelectableTotal;
  return (
    <div className="mx-auto max-w-[1560px] space-y-5 animate-in fade-in duration-300">
      {/* Top Section */}
      <div className="space-y-4">
        <Card className="glass-panel-strong overflow-hidden rounded-[30px] border-white/60 bg-white/76 shadow-[0_18px_46px_rgba(15,23,42,0.13)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/64">
          <CardContent className="p-5 md:p-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)] xl:items-start">
              <div className="min-w-0">
                <ChangeHeader
                  change={change}
                  gerritUrl={gerritUrl}
                  canShowMerge={canShowMerge}
                  mergeReady={mergeGuard.ready}
                  mergeHint={mergeGuard.hint}
                  submittingMerge={submittingMerge}
                  submittingReview={submittingReview}
                  aiReviewRunning={aiReviewRunning}
                  onBack={onBack}
                  onRefresh={async () => fetchDetail({ silent: true })}
                  onSubmitMerge={handleSubmitMerge}
                  onOpenReviewDialog={() => setShowReviewDialog(true)}
                  onOpenAiReviewDialog={() => setShowAiReviewDialog(true)}
                />

                <div className="mt-4">
                  <PeoplePanel
                    change={change}
                    gerritUrl={gerritUrl}
                    onAddReviewer={handleAddReviewer}
                    onRemoveReviewer={handleRemoveReviewer}
                  />
                </div>

              </div>
            </div>
          </CardContent>
        </Card>

        {aiReviewReport && (
          <Card className="glass-panel mt-4 border-l-4 border-l-sky-500/25 bg-white/72 shadow-[0_14px_34px_rgba(15,23,42,0.1)] backdrop-blur-lg supports-[backdrop-filter]:bg-white/58">
            <div className="border-b border-border/35 bg-white/40 px-4 py-3 backdrop-blur-md">
              <div
                className="flex cursor-pointer items-center justify-between gap-3"
                onClick={() => setAiReportCollapsed((prev) => !prev)}
                role="button"
                tabIndex={0}
                aria-expanded={!aiReportCollapsed}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setAiReportCollapsed((prev) => !prev);
                  }
                }}
              >
                <div className="flex min-w-0 items-center gap-2 text-left">
                  {aiReportCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Sparkles className="h-4 w-4 text-sky-500" />
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-medium text-foreground">AI Review Report</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'h-5 border px-1.5 text-[10px]',
                        RISK_LEVEL_META[aiReviewReport.overview.riskLevel].bgColor,
                        RISK_LEVEL_META[aiReviewReport.overview.riskLevel].textColor,
                        RISK_LEVEL_META[aiReviewReport.overview.riskLevel].borderColor
                      )}
                    >
                      {RISK_LEVEL_META[aiReviewReport.overview.riskLevel].label}
                    </Badge>
                  </div>
                </div>

                {!aiReportCollapsed && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {aiReviewReport.issues.length} findings
                  </span>
                )}
              </div>
            </div>

            {!aiReportCollapsed && (
              <CardContent className="space-y-3 p-4">
                <p className="text-sm leading-6 text-foreground/85">{aiReviewReport.overview.summary}</p>
                {aiReviewReport.overview.focusPoints.length > 0 && (
                  <div className="space-y-2 rounded-2xl border border-white/60 bg-white/58 px-3 py-3 backdrop-blur-lg supports-[backdrop-filter]:bg-white/46">
                    {aiReviewReport.overview.focusPoints.map((point, index) => (
                      <div key={`${point}-${index}`} className="text-sm text-foreground/80">
                        {point}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {relatedChanges.length > 0 && (
          <RelationChain
            relatedChanges={relatedChanges}
            currentChangeNumber={change._number}
            gerritUrl={gerritUrl}
            selectedRelatedKeys={selectedRelatedKeys}
            canVotePlusOne={canVotePlusOne}
            canVotePlusTwo={canVotePlusTwo}
            batchVoting={batchVoting}
            batchMerging={batchMerging}
            onToggleKey={(key) => {
              setSelectedRelatedKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            onSelectAll={() => setSelectedRelatedKeys(new Set(relatedChanges.map((c) => `${c._change_number}:${c._revision_number}`)))}
            onDeselectAll={() => setSelectedRelatedKeys(new Set())}
            onBatchVote={handleBatchVote}
            onBatchMerge={handleBatchMerge}
          />
        )}
      </div>

      <div className="space-y-5">
        <FileList
          files={displayFiles}
          onSelectFile={handleSelectFile}
          selectedFile={selectedFile}
          compareMode={compareMode}
          baseLabel={compareMode ? (baseRevisionId === PARENT_PATCHSET_ID ? 'PS0' : baseRevisionNumber ? `PS${baseRevisionNumber}` : 'Parent') : undefined}
          currentLabel={selectedRevisionNumber ? `PS${selectedRevisionNumber}` : 'Current'}
          totalInsertions={totalInsertions}
          totalDeletions={totalDeletions}
          currentDiff={currentDiff}
          loadingDiff={loadingDiff}
          fileComments={selectedFile === COMMIT_MESSAGE_FILE_PATH ? commitMessageComments : fileComments}
          onAddComment={selectedFile === COMMIT_MESSAGE_FILE_PATH ? handleAddCommitMessageComment : handleAddInlineComment}
          onReplyComment={selectedFile === COMMIT_MESSAGE_FILE_PATH ? handleReplyCommitMessageComment : handleReplyComment}
          onEditPendingComment={handleEditPendingComment}
          onDoneComment={selectedFile === COMMIT_MESSAGE_FILE_PATH ? handleResolveCommitMessageComment : handleResolveInlineComment}
          pendingCommentsByFile={pendingComments}
          onDeletePendingComment={handleDeletePendingComment}
          onSearchFile={handleSearchFile}
          pendingCommentCounts={Object.fromEntries(
            Object.entries(pendingComments).map(([f, arr]) => [f, arr.length])
          )}
          fileCommentCounts={Object.fromEntries(
            Object.entries(comments).map(([f, arr]) => [f, (arr || []).length])
          )}
          headerActions={
            <PatchSelector
              revisionsDesc={revisionsDesc}
              selectedRevisionId={selectedRevisionId}
              baseRevisionId={baseRevisionId}
              currentRevision={change.current_revision}
              revisionCommentCounts={revisionCommentCounts}
              onSelectRevision={(id) => {
                setSelectedRevisionId(id);
                const nextTarget = change.revisions?.[id];
                const currentBase = effectiveBaseRevisionId ? change.revisions?.[effectiveBaseRevisionId] : undefined;
                if (nextTarget && currentBase && nextTarget._number <= currentBase._number) {
                  const fallbackBaseId = revisionsDesc
                    .slice()
                    .reverse()
                    .find(([, rev]) => rev._number < nextTarget._number)?.[0];
                  setBaseRevisionId(fallbackBaseId || PARENT_PATCHSET_ID);
                }
                setSelectedFile(null);
                setCurrentDiff(null);
              }}
              onSelectBase={(id) => {
                setBaseRevisionId(id);
                if (id === PARENT_PATCHSET_ID) {
                  setSelectedFile(null);
                  setCurrentDiff(null);
                  return;
                }
                const nextBase = change.revisions?.[id];
                const currentTarget = selectedRevisionId ? change.revisions?.[selectedRevisionId] : undefined;
                if (nextBase && currentTarget && nextBase._number >= currentTarget._number) {
                  const fallbackTargetId = revisionsDesc
                    .find(([, rev]) => rev._number > nextBase._number)?.[0];
                  if (fallbackTargetId) setSelectedRevisionId(fallbackTargetId);
                }
                setSelectedFile(null);
                setCurrentDiff(null);
              }}
              onResetCompare={() => {
                const latestRevisionId = revisionsDesc[0]?.[0];
                if (latestRevisionId) setSelectedRevisionId(latestRevisionId);
                setBaseRevisionId(PARENT_PATCHSET_ID);
                setSelectedFile(null);
                setCurrentDiff(null);
              }}
            />
          }
          expandedCommentThreadId={expandedCommentThreadId}
          onExpandedCommentThreadChange={setExpandedCommentThreadId}
          lineHighlightsByFile={{
            [COMMIT_MESSAGE_FILE_PATH]: commitMessageHighlightMap,
          }}
          loadingLabelsByFile={{
            [COMMIT_MESSAGE_FILE_PATH]: checkingCommitMessage ? 'Checking commit message...' : undefined,
          }}
        />

        {Object.keys(pendingComments).length > 0 && (
          <div className="glass-panel flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/72 p-4 text-amber-800 shadow-[0_12px_28px_rgba(120,53,15,0.12)] backdrop-blur-lg supports-[backdrop-filter]:bg-amber-50/58">
            <MessageSquare className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {Object.values(pendingComments).reduce((sum, arr) => sum + arr.length, 0)} pending comments
              </p>
              <p className="text-xs opacity-90">
                These comments are saved as drafts locally. They will be sent when you submit your review.
                You can review them in the file list or delete them individually.
              </p>
            </div>
          </div>
        )}

        {commentLocatorEntries.length > 0 && (
          <Card className="glass-interactive overflow-hidden rounded-2xl border-border/55 bg-white/65 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/58">
            <CardContent className="p-0">
              <button
                onClick={() => setShowCommentHistory(!showCommentHistory)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Comment Locator ({commentLocatorEntries.length})
                </span>
                {showCommentHistory ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showCommentHistory && (
                <div className="border-t">
                  <div className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur">
                    <div className="flex flex-wrap items-center gap-2">
                      <GlassSearchInput
                        value={locatorQuery}
                        onChange={(event) => setLocatorQuery(event.target.value)}
                        placeholder="Search path / comment / line / author"
                        containerClassName="max-w-sm"
                        inputClassName="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant={locatorOnlyUnresolved ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setLocatorOnlyUnresolved((prev) => !prev)}
                      >
                        {locatorOnlyUnresolved ? 'Showing unresolved only' : 'Only unresolved'}
                      </Button>
                      <Badge variant="outline" className="h-6 text-[10px]">
                        {filteredCommentEntries.length}/{commentLocatorEntries.length} visible
                      </Badge>
                      <Badge variant="secondary" className="h-6 text-[10px]">
                        {unresolvedCommentCount} unresolved
                      </Badge>
                    </div>
                  </div>
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {filteredCommentEntries.length > 0 ? filteredCommentEntries.map((c) => (
                      <button
                        key={`${c.rootId}-${c.path}`}
                        onClick={() => {
                          setExpandedCommentThreadId(c.rootId);
                          setPendingCommentJump({
                            rootId: c.rootId,
                            path: c.path,
                            line: c.line,
                            patchSet: c.patchSet,
                            highlightTone: 'emerald',
                          });
                        }}
                        className="group w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45"
                      >
                      <div className="mb-1.5 flex items-center gap-2 text-[11px]">
                        <Badge variant="outline" className="text-[10px] bg-background">PS{c.patchSet || '?'}</Badge>
                        <LiquidTooltip content={c.path}>
                          <span className="font-mono text-foreground font-medium truncate max-w-[300px]">{c.path}</span>
                        </LiquidTooltip>
                        {c.unresolved && (
                          <Badge variant="secondary" className="h-5 border border-amber-300/70 bg-amber-100 text-[10px] text-amber-800">
                            unresolved
                          </Badge>
                        )}
                        <span className="text-muted-foreground ml-auto">{relativeTime(c.updated)}</span>
                      </div>
                      <LiquidTooltip content={`${c.authorName || 'Unknown'}: ${c.message || ''}`}>
                        <p className="truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                          {`${c.authorName || 'Unknown'}: ${c.message || ''}`}
                        </p>
                      </LiquidTooltip>
                    </button>
                    )) : (
                      <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                        No comments match the current filter.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {change.messages && change.messages.length > 0 && (
          <Card className="glass-interactive overflow-hidden rounded-2xl border-border/55 bg-white/65 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/58">
            <CardContent className="p-0">
              <button
                onClick={() => setShowMessages(!showMessages)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Review History ({scopedHistoryMessages.length})
                </span>
                {showMessages ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showMessages && (
                <div className="border-t">
                  <div className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur">
                    <div className="flex flex-wrap items-center gap-2">
                      <GlassSearchInput
                        value={historyQuery}
                        onChange={(event) => setHistoryQuery(event.target.value)}
                        placeholder="Search author / message / patchset"
                        containerClassName="max-w-sm"
                        inputClassName="h-8 text-xs"
                      />
                      <Badge variant="outline" className="h-6 text-[10px]">
                        {filteredMessages.length}/{scopedHistoryMessages.length} visible
                      </Badge>
                      <Badge variant="secondary" className="h-6 text-[10px]">
                        {autogeneratedMessageCount} autogenerated
                      </Badge>
                    </div>
                  </div>
                  <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                    {filteredMessages.length > 0 ? (
                      filteredMessages.map((msg) => (
                        <MessageItem key={msg.id} message={msg} gerritUrl={gerritUrl} />
                      ))
                    ) : (
                      <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                        No history entries match your search.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <ReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        onSubmit={handleSubmitReview}
        onTriggerInternalAgent={handleTriggerInternalAgent}
        availableLabels={availableLabels}
        initialScores={initialReviewScores}
        submitting={submittingReview}
      />

      <Dialog open={showAiReviewDialog} onOpenChange={setShowAiReviewDialog}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="border-b border-border/50 px-4 py-3">
            <DialogTitle>AI Review</DialogTitle>
          </DialogHeader>
          <AiReviewWorkspace
            changeNumber={changeNumber}
            revisionId={selectedRevisionId}
            baseRevisionId={compareMode ? effectiveBaseRevisionId : undefined}
            onAddDraftComment={handleAddAiDraftComment}
            onJumpToLine={jumpToDiffLine}
            onReviewQueued={() => setShowAiReviewDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showMergeConfirmDialog} onOpenChange={setShowMergeConfirmDialog}>
        <AlertDialogContent className="max-w-xl rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{mergeDialogMode === 'warning' ? '暂不建议 Merge' : '确认 Merge'}</AlertDialogTitle>
            <AlertDialogDescription>
              {mergeDialogMode === 'warning'
                ? `当前 Change #${changeNumber} 不满足合并前置条件，请先处理以下问题：`
                : `确认要提交 Change #${changeNumber} 的当前 patch set 吗？该操作将触发 Gerrit submit。`}
            </AlertDialogDescription>
            {mergeDialogMode === 'warning' && (
              <div className="mt-2 space-y-1.5 text-sm text-red-600">
                {mergeGuard.reasons.map((reason, index) => (
                  <div key={`${reason}-${index}`}>- {reason}</div>
                ))}
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submittingMerge}>
              {mergeDialogMode === 'warning' ? '我知道了' : '取消'}
            </AlertDialogCancel>
            {mergeDialogMode === 'confirm' && (
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleConfirmMerge();
                }}
                disabled={submittingMerge}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submittingMerge ? 'Merging...' : '确认 Merge'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {hasPendingUpdate && (
        <div className="fixed bottom-20 left-6 z-40">
          <Button
            type="button"
            onClick={() => {
              void handleApplyPendingUpdate();
            }}
            className="h-auto min-h-11 rounded-full border border-sky-200/80 bg-white/96 px-4 py-2.5 text-slate-900 shadow-[0_14px_40px_rgba(14,116,144,0.18)] backdrop-blur supports-[backdrop-filter]:bg-white/86"
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4 text-sky-600" />
            检测到更新，点击刷新
          </Button>
        </div>
      )}

      {unresolvedThreadTargets.length > 0 && (
        <div className="fixed bottom-20 right-6 z-40">
          <LiquidTooltip content={`Next unresolved (${unresolvedThreadTargets.length})`}>
            <Button
              type="button"
              onClick={handleJumpToNextUnresolved}
              className="h-11 w-11 rounded-full border border-amber-200/80 bg-white/96 text-amber-700 shadow-[0_14px_40px_rgba(245,158,11,0.18)] backdrop-blur supports-[backdrop-filter]:bg-white/86"
              variant="outline"
              size="icon"
              aria-label={`Jump to next unresolved comment. ${unresolvedThreadTargets.length} unresolved threads.`}
            >
              <div className="relative">
                <ArrowDown className="h-4 w-4" />
                <span className="absolute -right-2.5 -top-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-semibold text-white">
                  {unresolvedThreadTargets.length}
                </span>
              </div>
            </Button>
          </LiquidTooltip>
        </div>
      )}
    </div>
  );
}

// ─── Message Item ────────────────────────────────────────────────────────────

function MessageItem({ message, gerritUrl }: { message: GerritMessage; gerritUrl: string }) {
  const isAutogenerated = message.tag?.startsWith('autogenerated:');
  const author = message.author || message.real_author;

  return (
    <div className={cn('px-4 py-3 border-b border-border/40 last:border-0 text-sm', isAutogenerated && 'bg-muted/20')}>
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
           <span className="text-xs font-medium text-muted-foreground">
             {getAccountName(author)?.slice(0, 2).toUpperCase()}
           </span>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <a
                href={`${gerritUrl}/q/owner:${encodeURIComponent(author?.email || author?.username || getAccountName(author))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                {getAccountName(author)}
              </a>
              {message._revision_number && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 text-muted-foreground bg-muted">
                  PS{message._revision_number}
                </Badge>
              )}
            </div>
            <LiquidTooltip content={new Date(message.date).toLocaleString()}>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {relativeTime(message.date)}
              </span>
            </LiquidTooltip>
          </div>
          <div className={cn("text-foreground/90 whitespace-pre-wrap leading-relaxed break-words", isAutogenerated && "text-muted-foreground font-mono text-xs")}>
            {message.message}
          </div>
        </div>
      </div>
    </div>
  );
}
