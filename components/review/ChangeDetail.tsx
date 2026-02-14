import { useState, useEffect, useCallback } from 'react';
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
import { ReviewSidebar } from './ReviewSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

function buildPendingLocalKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildPendingCommentsStorageKey(changeNumber: number, revisionId?: string): string {
  return `review-pending-comments:${changeNumber}:${revisionId || 'current'}`;
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
  const [relatedChanges, setRelatedChanges] = useState<GerritRelatedChange[]>([]);
  const [selectedRelatedKeys, setSelectedRelatedKeys] = useState<Set<string>>(new Set());

  // Inline comments state (accumulated per file before submission)
  const [pendingComments, setPendingComments] = useState<Record<string, { localKey: string; line: number; message: string; in_reply_to?: string }[]>>({});

  // (Reviewer add/remove UI state moved to ReviewSidebar)

  const pendingCommentsStorageKey = buildPendingCommentsStorageKey(
    changeNumber,
    selectedRevisionId || change?.current_revision
  );

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      setError(err.message || 'Failed to load change detail');
    } finally {
      setLoading(false);
    }
  }, [baseRevisionId, changeNumber, compareMode, selectedRevisionId]);

  useEffect(() => {
    fetchDetail();
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
      setPendingComments(parsed as Record<string, { localKey: string; line: number; message: string; in_reply_to?: string }[]>);
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
      toast.error(`未找到文件：${rawPath}`);
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
      [selectedFile]: [...(prev[selectedFile] || []), { localKey: buildPendingLocalKey('inline'), line, message }],
    }));
    toast.success(`已添加第 ${line} 行评论（提交 Review 时一起发送）`);
  }, [selectedFile]);

  // Reply to an existing comment (adds as pending with in_reply_to)
  const handleReplyComment = useCallback((commentId: string, line: number | undefined, message: string) => {
    if (!selectedFile) return;
    setPendingComments((prev) => ({
      ...prev,
      [selectedFile]: [...(prev[selectedFile] || []), { localKey: buildPendingLocalKey('reply'), line: line || 0, message, in_reply_to: commentId }],
    }));
    toast.success('已添加回复（提交 Review 时一起发送）');
  }, [selectedFile]);

  // Add draft comment from AI issue card
  const handleAddAiDraftComment = useCallback((file: string, line: number, message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const resolvedFile = resolveFilePath(file);
    if (!resolvedFile) {
      toast.error(`未找到文件：${file}`);
      return;
    }

    const localKey = buildPendingLocalKey('ai');

    // Check for duplicates before updating state to avoid side-effects inside setState
    const existing = pendingComments[resolvedFile] || [];
    const duplicated = existing.some((c) => c.line === line && c.message.trim() === trimmed && !c.in_reply_to);
    if (duplicated) {
      toast.info('该 AI 建议已在待发送评论中');
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

    toast.success(`已将 AI 建议加入草稿：${resolvedFile}:${line}`, {
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
    toast.success('已删除草稿评论');
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
          toast.success(`在 ${file.path} 中找到匹配内容`);
          return;
        }
      } catch {
        // Skip files that fail to load
      }
    }
    toast.error(`未在任何文件中找到 "${query}"`);
  }, [baseRevisionId, changeNumber, compareMode, files, selectedRevisionId]);

  // Submit review (includes pending inline comments)
  const handleSubmitReview = useCallback(async (data: { message: string; labels: Record<string, number> }) => {
    setSubmittingReview(true);
    try {
      // Convert pending comments to Gerrit format
      const commentsPayload: Record<string, { line?: number; message: string; in_reply_to?: string }[]> = {};
      for (const [file, fileComments] of Object.entries(pendingComments)) {
        commentsPayload[file] = fileComments.map((c) => {
          const entry: { line?: number; message: string; in_reply_to?: string } = { message: c.message };
          if (c.line) entry.line = c.line;
          if (c.in_reply_to) entry.in_reply_to = c.in_reply_to;
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
      toast.success('Review 提交成功');
      setPendingComments({});
      fetchDetail();
    } catch (err: any) {
      toast.error('提交失败: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmittingReview(false);
    }
  }, [changeNumber, fetchDetail, pendingComments, selectedRevisionId]);

  const handleSubmitMerge = useCallback(async () => {
    setSubmittingMerge(true);
    setMergeError(null);
    try {
      await httpPost('/api/gerrit/submit', {
        changeId: changeNumber,
        revisionId: selectedRevisionId || 'current',
      });
      toast.success('已提交合入（Submit）');
      fetchDetail();
    } catch (err: any) {
      const message = extractApiErrorMessage(err);
      setMergeError(message);
      const signal = classifySubmitSignal(message);
      if (signal === 'merge-conflict') {
        toast.error('合入失败：Merge Conflict（请处理冲突后重试）');
      } else if (signal === 'not-current-rebase') {
        toast.error('合入失败：Not current，rebase 后可重试');
      } else {
        toast.error(`合入失败：${message}`);
      }
    } finally {
      setSubmittingMerge(false);
    }
  }, [changeNumber, fetchDetail, selectedRevisionId]);

  const handleBatchVote = useCallback(async (score: 1 | 2) => {
    const targets = relatedChanges.filter((c) => selectedRelatedKeys.has(`${c._change_number}:${c._revision_number}`));
    const newTargets = targets.filter((c) => c.status === 'NEW');
    if (targets.length === 0) {
      toast.info('请先勾选 Relation chain 提交');
      return;
    }
    if (newTargets.length === 0) {
      toast.info('所选提交中没有可投票的 NEW 提交');
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
      toast.success(`批量 +${score} 成功：${success}/${newTargets.length}`);
    } else {
      toast.error(`批量 +${score} 部分失败：成功 ${success}，失败 ${failed.join(', ')}`);
    }
    fetchDetail();
  }, [change?.labels, fetchDetail, relatedChanges, selectedRelatedKeys]);

  const handleBatchMerge = useCallback(async () => {
    const targets = relatedChanges.filter((c) => selectedRelatedKeys.has(`${c._change_number}:${c._revision_number}`));
    const newTargets = targets.filter((c) => c.status === 'NEW');
    if (targets.length === 0) {
      toast.info('请先勾选 Relation chain 提交');
      return;
    }
    if (newTargets.length === 0) {
      toast.info('所选提交中没有可合入的 NEW 提交');
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
        });
        success += 1;
      } catch {
        failed.push(target._change_number);
      }
    }
    setBatchMerging(false);
    if (failed.length === 0) {
      toast.success(`批量 Merge 成功：${success}/${newTargets.length}`);
    } else {
      toast.error(`批量 Merge 部分失败：成功 ${success}，失败 ${failed.join(', ')}`);
    }
    fetchDetail();
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
          toast.info(`已定位到文件 ${openedFile}，第 ${line} 行不在当前展开片段中`);
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
      toast.success(`已添加 ${state === 'CC' ? '抄送' : '评审者'}: ${account.name || account.email || identifier}`);
      fetchDetail();
    } catch (err: any) {
      toast.error('添加失败: ' + (err.message || 'Unknown error'));
    }
  }, [changeNumber, fetchDetail]);

  // Remove reviewer
  const handleRemoveReviewer = useCallback(async (accountId: number) => {
    try {
      await httpPost(`/api/gerrit/reviewers?changeId=${changeNumber}`, { accountId, _method: 'DELETE' });
      toast.success('已移除');
      fetchDetail();
    } catch (err: any) {
      toast.error('移除失败: ' + (err.message || 'Unknown error'));
    }
  }, [changeNumber, fetchDetail]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载变更详情...</span>
      </div>
    );
  }

  if (error || !change) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-sm text-red-600">{error || '未找到变更'}</p>
        <Button variant="outline" size="sm" onClick={onBack}>返回</Button>
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
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <ChangeHeader
            change={change}
            gerritUrl={gerritUrl}
            commitMessage={selectedRevisionCommitMessage}
            canShowMerge={canShowMerge}
            submittingMerge={submittingMerge}
            submittingReview={submittingReview}
            onBack={onBack}
            onRefresh={fetchDetail}
            onSubmitMerge={handleSubmitMerge}
          />

          <PatchSelector
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
          />

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
        </CardContent>
      </Card>

      {/* Two-column layout: Files + Diff on left, Review on right */}
      <div className="flex gap-4">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
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
            pendingCommentsByFile={pendingComments}
            onDeletePendingComment={handleDeletePendingComment}
            onSearchFile={handleSearchFile}
            pendingCommentCounts={Object.fromEntries(
              Object.entries(pendingComments).map(([f, arr]) => [f, arr.length])
            )}
          />

          {Object.keys(pendingComments).length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>
                {Object.values(pendingComments).reduce((sum, arr) => sum + arr.length, 0)} 条待发送评论
                （已显示在对应代码行下方，可直接删除）
              </span>
            </div>
          )}

          {change.messages && change.messages.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <button
                  onClick={() => setShowMessages(!showMessages)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    评审历史 ({change.messages.length})
                  </span>
                  {showMessages ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {showMessages && (
                  <div className="border-t divide-y divide-border max-h-96 overflow-y-auto">
                    {change.messages.map((msg) => (
                      <MessageItem key={msg.id} message={msg} gerritUrl={gerritUrl} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {commentEntries.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <button
                  onClick={() => setShowCommentHistory(!showCommentHistory)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    评论定位 ({commentEntries.length})
                  </span>
                  {showCommentHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {showCommentHistory && (
                  <div className="border-t divide-y divide-border max-h-80 overflow-y-auto">
                    {commentEntries.map((c) => (
                      <button
                        key={`${c.id}-${c.path}`}
                        onClick={() => jumpToCommentLocation(c.path, c.line, c.patch_set)}
                        className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-[11px] mb-1">
                          <Badge variant="outline" className="text-[10px]">PS{c.patch_set || '?'}</Badge>
                          <span className="font-mono text-muted-foreground truncate">{c.path}</span>
                          {typeof c.line === 'number' && <span className="text-muted-foreground">L{c.line}</span>}
                          <span className="text-muted-foreground ml-auto">{relativeTime(c.updated)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.message}</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <ReviewSidebar
          change={change}
          gerritUrl={gerritUrl}
          changeNumber={changeNumber}
          selectedRevisionId={selectedRevisionId}
          compareMode={compareMode}
          baseRevisionId={baseRevisionId}
          availableLabels={availableLabels}
          submittingReview={submittingReview}
          totalInsertions={totalInsertions}
          totalDeletions={totalDeletions}
          fileCount={files.length}
          onSubmitReview={handleSubmitReview}
          onAddDraftComment={handleAddAiDraftComment}
          onJumpToLine={jumpToDiffLine}
          onAddReviewer={handleAddReviewer}
          onRemoveReviewer={handleRemoveReviewer}
        />
      </div>
    </div>
  );
}

// ─── Message Item ────────────────────────────────────────────────────────────

function MessageItem({ message, gerritUrl }: { message: GerritMessage; gerritUrl: string }) {
  const isAutogenerated = message.tag?.startsWith('autogenerated:');
  const author = message.author || message.real_author;

  return (
    <div className={cn('px-3 py-2', isAutogenerated && 'bg-muted/30')}>
      <div className="flex items-center gap-2 text-xs mb-1">
        <a
          href={`${gerritUrl}/q/owner:${encodeURIComponent(author?.email || author?.username || getAccountName(author))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground hover:text-primary underline-offset-2 hover:underline"
        >
          {getAccountName(author)}
        </a>
        {message._revision_number && (
          <Badge variant="outline" className="text-[10px]">PS{message._revision_number}</Badge>
        )}
        <span className="text-muted-foreground ml-auto">{relativeTime(message.date)}</span>
      </div>
      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {message.message}
      </p>
    </div>
  );
}
