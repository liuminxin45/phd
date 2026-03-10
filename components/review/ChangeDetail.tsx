import { useState, useEffect, useCallback, useRef } from 'react';
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
import { FileList } from './DiffViewer';
import { ChangeHeader } from './ChangeHeader';
import { PatchSelector } from './PatchSelector';
import { RelationChain } from './RelationChain';
import { PeoplePanel } from './PeoplePanel';
import { ReviewDialog } from './ReviewDialog';
import { AiReviewWorkspace } from './AiReviewWorkspace';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

function buildPendingLocalKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildPendingCommentsStorageKey(changeNumber: number, revisionId?: string): string {
  return `review-pending-comments:${changeNumber}:${revisionId || 'current'}`;
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

interface ChangeDetailProps {
  changeNumber: number;
  gerritUrl: string;
  onBack: () => void;
}

export function ChangeDetail({ changeNumber, gerritUrl, onBack }: ChangeDetailProps) {
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
  const [compareMode, setCompareMode] = useState(false);

  // Review state
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittingMerge, setSubmittingMerge] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [batchVoting, setBatchVoting] = useState<0 | 1 | 2>(0);
  const [batchMerging, setBatchMerging] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showCommentHistory, setShowCommentHistory] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [relatedChanges, setRelatedChanges] = useState<GerritRelatedChange[]>([]);
  const [selectedRelatedKeys, setSelectedRelatedKeys] = useState<Set<string>>(new Set());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const aiWorkspaceRef = useRef<HTMLDivElement | null>(null);

  // Inline comments state (accumulated per file before submission)
  const [pendingComments, setPendingComments] = useState<Record<string, { localKey: string; line: number; message: string; in_reply_to?: string; unresolved?: boolean }[]>>({});

  // (Reviewer add/remove UI state moved to ReviewSidebar)

  const pendingCommentsStorageKey = buildPendingCommentsStorageKey(
    changeNumber,
    selectedRevisionId || change?.current_revision
  );

  const fetchDetail = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await httpGet<{
        change: GerritChange;
        comments: Record<string, GerritCommentInfo[]>;
        files: Record<string, GerritFileInfo>;
        related: GerritRelatedChange[];
      }>(
        '/api/gerrit/change-detail',
        {
          id: changeNumber,
          revision: selectedRevisionId,
          base: compareMode ? baseRevisionId : undefined,
        }
      );

      setChange(res.change);
      setComments(res.comments || {});
      setRelatedChanges(res.related || []);

      // Convert files map to array
      const fileEntries: FileEntry[] = Object.entries(res.files || {})
        .filter(([path]) => path !== '/COMMIT_MSG')
        .map(([path, info]) => ({
          path,
          status: info.status || 'M',
          linesInserted: info.lines_inserted || 0,
          linesDeleted: info.lines_deleted || 0,
          binary: info.binary || false,
        }))
        .sort((a, b) => a.path.localeCompare(b.path));

      setFiles(fileEntries);
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'Failed to load change detail');
      } else {
        toast.error(err.message || 'Failed to refresh change detail');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [baseRevisionId, changeNumber, compareMode, selectedRevisionId]);

  useEffect(() => {
    void fetchDetail();
    refreshIntervalRef.current = setInterval(() => {
      void fetchDetail({ silent: true });
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
    if (!change?.revisions || !selectedRevisionId) return;
    if (!compareMode) return;

    const revisionsAsc = Object.entries(change.revisions)
      .sort(([, a], [, b]) => a._number - b._number);
    const selectedRev = change.revisions[selectedRevisionId];
    if (!selectedRev) return;

    const previousRevisionId = revisionsAsc
      .filter(([, rev]) => rev._number < selectedRev._number)
      .at(-1)?.[0];

    if (baseRevisionId === selectedRevisionId || (baseRevisionId && !change.revisions[baseRevisionId])) {
      setBaseRevisionId(previousRevisionId);
      return;
    }

    if (!baseRevisionId) {
      setBaseRevisionId(previousRevisionId);
    }
  }, [baseRevisionId, change, compareMode, selectedRevisionId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(pendingCommentsStorageKey);
      if (!raw) {
        setPendingComments({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        setPendingComments({});
        return;
      }
      setPendingComments(parsed as Record<string, { localKey: string; line: number; message: string; in_reply_to?: string; unresolved?: boolean }[]>);
    } catch {
      setPendingComments({});
    }
  }, [pendingCommentsStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(pendingCommentsStorageKey, JSON.stringify(pendingComments));
    } catch {
      // ignore localStorage failures
    }
  }, [pendingComments, pendingCommentsStorageKey]);

  useEffect(() => {
    const defaults = new Set(
      relatedChanges
        .filter((c) => c.status === 'NEW')
        .map((c) => `${c._change_number}:${c._revision_number}`)
    );
    setSelectedRelatedKeys(defaults);
  }, [relatedChanges]);

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
      const diff = await httpGet<GerritDiffInfo>('/api/gerrit/diff', {
        id: changeNumber,
        file: path,
        revision: selectedRevisionId,
        base: compareMode ? baseRevisionId : undefined,
      });
      setCurrentDiff(diff);
      return true;
    } catch {
      setCurrentDiff(null);
      return false;
    } finally {
      setLoadingDiff(false);
    }
  }, [baseRevisionId, changeNumber, compareMode, selectedRevisionId]);

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

  const ensureFileOpen = useCallback(async (rawPath: string) => {
    const resolvedPath = resolveFilePath(rawPath);
    if (!resolvedPath) {
      toast.error(`File not found: ${rawPath}`);
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

  // Add inline comment to pending list
  const handleAddInlineComment = useCallback((line: number, message: string) => {
    if (!selectedFile) return;
    setPendingComments((prev) => ({
      ...prev,
      [selectedFile]: [...(prev[selectedFile] || []), { localKey: buildPendingLocalKey('inline'), line, message, unresolved: true }],
    }));
    toast.success(`Comment added on line ${line} (pending submission)`);
  }, [selectedFile]);

  // Reply to an existing comment (adds as pending with in_reply_to)
  const handleReplyComment = useCallback((commentId: string, line: number | undefined, message: string, unresolved?: boolean) => {
    if (!selectedFile) return;
    setPendingComments((prev) => ({
      ...prev,
      [selectedFile]: [...(prev[selectedFile] || []), { localKey: buildPendingLocalKey('reply'), line: line || 0, message, in_reply_to: commentId, unresolved }],
    }));
    toast.success('Reply added (pending submission)');
  }, [selectedFile]);

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

  const handleResolveInlineComment = useCallback(async (commentId: string, line: number | undefined) => {
    if (!selectedFile) return;
    try {
      await httpPost('/api/gerrit/review', {
        changeId: changeNumber,
        revisionId: selectedRevisionId || 'current',
        message: 'Done',
        comments: {
          [selectedFile]: [
            {
              in_reply_to: commentId,
              message: 'Done',
              ...(typeof line === 'number' ? { line } : {}),
              unresolved: false,
            },
          ],
        },
      });
      toast.success('Comment marked as resolved');
      
      // Clear any pending replies for this comment since we just posted a "Done" reply
      if (selectedFile) {
        setPendingComments((prev) => {
          const existing = prev[selectedFile] || [];
          const filtered = existing.filter((c) => c.in_reply_to !== commentId);
          if (filtered.length === existing.length) return prev;
          const next = { ...prev };
          if (filtered.length === 0) {
            delete next[selectedFile];
          } else {
            next[selectedFile] = filtered;
          }
          return next;
        });
      }
      
      // Small delay to ensure Gerrit has processed the resolved status before refreshing
      setTimeout(() => {
        clearPendingCommentsStorageForChange(changeNumber);
        void fetchDetail({ silent: true });
      }, 500);
    } catch (err: any) {
      toast.error('Failed to resolve comment: ' + (err.message || 'Unknown error'));
    }
  }, [changeNumber, fetchDetail, selectedFile, selectedRevisionId]);

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
    // Search through all files by loading their diffs one by one
    for (const file of files) {
      if (file.binary) continue;
      try {
        const diff = await httpGet<GerritDiffInfo>('/api/gerrit/diff', {
          id: changeNumber,
          file: file.path,
          revision: selectedRevisionId,
          base: compareMode ? baseRevisionId : undefined,
        });
        // Check if any content contains the search query
        const found = diff.content?.some((chunk: any) =>
          (chunk.ab || []).some((l: string) => l.includes(query)) ||
          (chunk.a || []).some((l: string) => l.includes(query)) ||
          (chunk.b || []).some((l: string) => l.includes(query))
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
    toast.error(`No matches found for "${query}"`);
  }, [baseRevisionId, changeNumber, compareMode, files, selectedRevisionId]);

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

  const handleSubmitMerge = useCallback(async () => {
    const confirmed = window.confirm(`确认 Merge 变更 #${changeNumber} 吗？\n\n该操作将提交当前 patch set。`);
    if (!confirmed) return;

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

  const jumpToCommentLocation = useCallback((file: string, line?: number, patchSet?: number) => {
    const revisionForPatch = patchSet
      ? Object.entries(change?.revisions || {}).find(([, rev]) => rev._number === patchSet)?.[0]
      : undefined;
    const delay = revisionForPatch && revisionForPatch !== selectedRevisionId ? 500 : 160;

    if (revisionForPatch && revisionForPatch !== selectedRevisionId) {
      setSelectedRevisionId(revisionForPatch);
      setCompareMode(false);
      setBaseRevisionId(undefined);
    }

    setTimeout(() => {
      handleSelectFile(file);
      if (!line) return;
      setTimeout(() => {
        const lineEl = document.querySelector(`[data-diff-line="${file}:${line}"]`);
        if (lineEl) {
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          lineEl.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-1');
          setTimeout(() => lineEl.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-1'), 2500);
        }
      }, 420);
    }, delay);
  }, [change?.revisions, handleSelectFile, selectedRevisionId]);

  const jumpToDiffLine = useCallback((file: string, line: number) => {
    ensureFileOpen(file).then((openedFile) => {
      if (!openedFile) return;
      setTimeout(() => {
        const lineEl = document.querySelector(`[data-diff-line="${openedFile}:${line}"]`);
        if (lineEl) {
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          lineEl.classList.add('ring-2', 'ring-blue-400', 'ring-offset-1');
          setTimeout(() => lineEl.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-1'), 3000);
        } else {
          toast.info(`Located ${openedFile}, but line ${line} is hidden in collapsed region`);
        }
      }, 220);
    });
  }, [ensureFileOpen]);

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

  const handleOpenAiWorkspace = useCallback(() => {
    if (!aiWorkspaceRef.current) return;
    aiWorkspaceRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading change details...</span>
      </div>
    );
  }

  if (error || !change) {
    return (
      <div className="text-center py-20 space-y-3">
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

  const revisionsDesc = Object.entries(change.revisions || {})
    .sort(([, a], [, b]) => b._number - a._number);

  const selectedRevisionNumber = selectedRevisionId && change.revisions?.[selectedRevisionId]
    ? change.revisions[selectedRevisionId]._number
    : undefined;

  const baseRevisionCandidates = revisionsDesc
    .filter(([id, rev]) => id !== selectedRevisionId && selectedRevisionNumber ? rev._number < selectedRevisionNumber : true);

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

  const currentSubmitSignal = classifySubmitSignal(mergeError || '') || latestSubmitSignalFromHistory || null;

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

  const selectedRevisionCommitMessage = selectedRevisionId
    ? change.revisions?.[selectedRevisionId]?.commit?.message
    : undefined;

  const relatedSelectableTotal = relatedChanges.length;
  const relatedSelectedTotal = relatedChanges.filter((c) => selectedRelatedKeys.has(`${c._change_number}:${c._revision_number}`)).length;
  const relatedAllChecked = relatedSelectableTotal > 0 && relatedSelectedTotal === relatedSelectableTotal;
  const relatedSomeChecked = relatedSelectedTotal > 0 && relatedSelectedTotal < relatedSelectableTotal;

  const commentEntries = Object.entries(comments || {})
    .flatMap(([path, arr]) => (arr || []).map((c) => ({ path, ...c })))
    .sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));

  return (
    <div className="mx-auto max-w-[1560px] space-y-5">
      {/* Top Section */}
      <div className="space-y-4">
        <Card className="overflow-hidden rounded-[26px] border border-border/50 bg-background/95 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
          <CardContent className="p-5 md:p-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
              <div className="min-w-0">
                <ChangeHeader
                  change={change}
                  gerritUrl={gerritUrl}
                  canShowMerge={canShowMerge}
                  submittingMerge={submittingMerge}
                  submittingReview={submittingReview}
                  onBack={onBack}
                  onRefresh={() => {
                    void fetchDetail({ silent: true });
                  }}
                  onSubmitMerge={handleSubmitMerge}
                  onOpenReviewDialog={() => setShowReviewDialog(true)}
                  onOpenAiWorkspace={handleOpenAiWorkspace}
                  selectedPatchsetNumber={selectedRevisionNumber}
                  fileCount={files.length}
                  totalInsertions={totalInsertions}
                  totalDeletions={totalDeletions}
                />

                <Separator className="my-5" />

                {selectedRevisionCommitMessage && (
                  <div className="mb-4 min-w-0 rounded-2xl border border-border/50 bg-muted/[0.018] px-4 py-3.5">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Commit Message
                    </div>
                    <pre className="w-full whitespace-pre-wrap break-words font-mono text-[13px] leading-7 text-foreground/88 max-h-[min(42rem,calc(100vh-14rem))] overflow-y-auto">
                      {selectedRevisionCommitMessage}
                    </pre>
                  </div>
                )}

              </div>

              <aside className="space-y-3 xl:sticky xl:top-6">
                <div ref={aiWorkspaceRef}>
                  <AiReviewWorkspace
                    changeNumber={changeNumber}
                    revisionId={selectedRevisionId}
                    baseRevisionId={compareMode ? baseRevisionId : undefined}
                    onAddDraftComment={handleAddAiDraftComment}
                    onJumpToLine={jumpToDiffLine}
                  />
                </div>

                <PeoplePanel
                  change={change}
                  gerritUrl={gerritUrl}
                  onAddReviewer={handleAddReviewer}
                  onRemoveReviewer={handleRemoveReviewer}
                />
              </aside>
            </div>
          </CardContent>
        </Card>

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
        <PatchSelector
          compact
          revisionsDesc={revisionsDesc}
          selectedRevisionId={selectedRevisionId}
          baseRevisionId={baseRevisionId}
          compareMode={compareMode}
          currentRevision={change.current_revision}
          revisionCommentCounts={revisionCommentCounts}
          baseRevisionCandidates={baseRevisionCandidates}
          currentSubmitSignal={currentSubmitSignal}
          onSelectRevision={(id) => {
            setSelectedRevisionId(id);
            setSelectedFile(null);
            setCurrentDiff(null);
          }}
          onToggleCompare={() => {
            setCompareMode((prev) => !prev);
            setSelectedFile(null);
            setCurrentDiff(null);
          }}
          onSelectBase={(id) => {
            setBaseRevisionId(id);
            setSelectedFile(null);
            setCurrentDiff(null);
          }}
          onStartCompareWith={(id) => {
            setCompareMode(true);
            setBaseRevisionId(id);
            setSelectedFile(null);
            setCurrentDiff(null);
          }}
        />

        <FileList
          files={files}
          onSelectFile={handleSelectFile}
          selectedFile={selectedFile}
          totalInsertions={totalInsertions}
          totalDeletions={totalDeletions}
          currentDiff={currentDiff}
          loadingDiff={loadingDiff}
          fileComments={fileComments}
          onAddComment={handleAddInlineComment}
          onReplyComment={handleReplyComment}
          onEditPendingComment={handleEditPendingComment}
          onDoneComment={handleResolveInlineComment}
          pendingCommentsByFile={pendingComments}
          onDeletePendingComment={handleDeletePendingComment}
          onSearchFile={handleSearchFile}
          pendingCommentCounts={Object.fromEntries(
            Object.entries(pendingComments).map(([f, arr]) => [f, arr.length])
          )}
        />

        {Object.keys(pendingComments).length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm">
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

        {change.messages && change.messages.length > 0 && (
          <Card className="overflow-hidden rounded-2xl border-border/50 shadow-none">
            <CardContent className="p-0">
              <button
                onClick={() => setShowMessages(!showMessages)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Review History ({change.messages.length})
                </span>
                {showMessages ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showMessages && (
                <div className="border-t divide-y divide-border max-h-[500px] overflow-y-auto">
                  {change.messages.map((msg) => (
                    <MessageItem key={msg.id} message={msg} gerritUrl={gerritUrl} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {commentEntries.length > 0 && (
          <Card className="overflow-hidden rounded-2xl border-border/50 shadow-none">
            <CardContent className="p-0">
              <button
                onClick={() => setShowCommentHistory(!showCommentHistory)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Comment Locator ({commentEntries.length})
                </span>
                {showCommentHistory ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showCommentHistory && (
                <div className="border-t divide-y divide-border max-h-80 overflow-y-auto">
                  {commentEntries.map((c) => (
                    <button
                      key={`${c.id}-${c.path}`}
                      onClick={() => jumpToCommentLocation(c.path, c.line, c.patch_set)}
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-[11px] mb-1.5">
                        <Badge variant="outline" className="text-[10px] bg-background">PS{c.patch_set || '?'}</Badge>
                        <span className="font-mono text-foreground font-medium truncate max-w-[300px]" title={c.path}>{c.path}</span>
                        {typeof c.line === 'number' && <span className="text-muted-foreground font-mono">L{c.line}</span>}
                        <span className="text-muted-foreground ml-auto">{relativeTime(c.updated)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">{c.message}</p>
                    </button>
                  ))}
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
        submitting={submittingReview}
      />
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
            <span className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(message.date).toLocaleString()}>
              {relativeTime(message.date)}
            </span>
          </div>
          <div className={cn("text-foreground/90 whitespace-pre-wrap leading-relaxed break-words", isAutogenerated && "text-muted-foreground font-mono text-xs")}>
            {message.message}
          </div>
        </div>
      </div>
    </div>
  );
}
