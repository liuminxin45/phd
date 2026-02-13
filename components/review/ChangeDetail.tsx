import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { httpGet, httpPost } from '@/lib/httpClient';
import {
  relativeTime,
  formatGerritDate,
  getAccountName,
  abbreviateProject,
  getStatusColor,
  getStatusLabel,
  getFileStatusLabel,
} from '@/lib/gerrit/helpers';
import type {
  GerritChange,
  GerritDiffInfo,
  GerritCommentInfo,
  GerritFileInfo,
  GerritMessage,
} from '@/lib/gerrit/types';
import { LabelsSummary } from './LabelBadge';
import { FileList } from './DiffViewer';
import { ReviewPanel } from './ReviewPanel';
import { AccountSearch } from './AccountSearch';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  GitMerge,
  MessageSquare,
  Clock,
  User,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Plus,
  X,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChangeDetailProps {
  changeNumber: number;
  gerritUrl: string;
  onBack: () => void;
}

interface FileEntry {
  path: string;
  status?: string;
  linesInserted?: number;
  linesDeleted?: number;
  binary?: boolean;
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

  // Review state
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  // Inline comments state (accumulated per file before submission)
  const [pendingComments, setPendingComments] = useState<Record<string, { line: number; message: string; in_reply_to?: string }[]>>({});

  // Reviewer management
  const [addingReviewer, setAddingReviewer] = useState(false);
  const [addingCC, setAddingCC] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpGet<{ change: GerritChange; comments: Record<string, GerritCommentInfo[]>; files: Record<string, GerritFileInfo> }>(
        '/api/gerrit/change-detail',
        { id: changeNumber }
      );

      setChange(res.change);
      setComments(res.comments || {});

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
  }, [changeNumber]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Load diff when file is selected
  const handleSelectFile = useCallback(async (path: string) => {
    if (selectedFile === path) {
      setSelectedFile(null);
      setCurrentDiff(null);
      return;
    }

    setSelectedFile(path);
    setLoadingDiff(true);
    try {
      const diff = await httpGet<GerritDiffInfo>('/api/gerrit/diff', {
        id: changeNumber,
        file: path,
      });
      setCurrentDiff(diff);
    } catch {
      setCurrentDiff(null);
    } finally {
      setLoadingDiff(false);
    }
  }, [changeNumber, selectedFile]);

  // Add inline comment to pending list
  const handleAddInlineComment = useCallback((line: number, message: string) => {
    if (!selectedFile) return;
    setPendingComments((prev) => ({
      ...prev,
      [selectedFile]: [...(prev[selectedFile] || []), { line, message }],
    }));
    toast.success(`已添加第 ${line} 行评论（提交 Review 时一起发送）`);
  }, [selectedFile]);

  // Reply to an existing comment (adds as pending with in_reply_to)
  const handleReplyComment = useCallback((commentId: string, line: number | undefined, message: string) => {
    if (!selectedFile) return;
    setPendingComments((prev) => ({
      ...prev,
      [selectedFile]: [...(prev[selectedFile] || []), { line: line || 0, message, in_reply_to: commentId }],
    }));
    toast.success('已添加回复（提交 Review 时一起发送）');
  }, [selectedFile]);

  // Search across all file diffs
  const handleSearchFile = useCallback(async (query: string) => {
    // Search through all files by loading their diffs one by one
    for (const file of files) {
      if (file.binary) continue;
      try {
        const diff = await httpGet<GerritDiffInfo>('/api/gerrit/diff', { id: changeNumber, file: file.path });
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
  }, [files, changeNumber]);

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
        revisionId: 'current',
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
  }, [changeNumber, fetchDetail, pendingComments]);

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

  // Get available labels from change
  const availableLabels = change.labels ? Object.keys(change.labels) : ['Code-Review'];

  // Get file-specific comments for selected file
  const fileComments = selectedFile ? (comments[selectedFile] || []) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground leading-tight">
                  {change.subject}
                </h1>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                  <Badge variant="secondary" className={cn('text-[10px]', getStatusColor(change.status))}>
                    {getStatusLabel(change.status)}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {abbreviateProject(change.project)} → {change.branch}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {getAccountName(change.owner)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {relativeTime(change.updated)}
                  </span>
                  <span className="font-mono">#{change._number}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchDetail} title="刷新">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <a
                href={`${gerritUrl}/c/${change._number}`}
                className="inline-flex"
              >
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Gerrit
                </Button>
              </a>
            </div>
          </div>

          {/* Labels */}
          {change.labels && (
            <div className="mt-3 pt-3 border-t border-border">
              <LabelsSummary labels={change.labels} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-column layout: Files + Diff on left, Review on right */}
      <div className="flex gap-4">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* File List with inline diffs */}
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
            onSearchFile={handleSearchFile}
            pendingCommentCounts={Object.fromEntries(
              Object.entries(pendingComments).map(([f, arr]) => [f, arr.length])
            )}
          />

          {/* Pending inline comments indicator */}
          {Object.keys(pendingComments).length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>
                {Object.values(pendingComments).reduce((sum, arr) => sum + arr.length, 0)} 条待发送评论
                （提交 Review 时一起发送）
              </span>
            </div>
          )}

          {/* Messages / History */}
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
                      <MessageItem key={msg.id} message={msg} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar: Review Panel */}
        <div className="w-80 shrink-0 hidden lg:block space-y-4">
          <ReviewPanel
            onSubmit={handleSubmitReview}
            availableLabels={availableLabels}
            submitting={submittingReview}
          />

          {/* Reviewers info with add/remove */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">评审者</p>
                <button onClick={() => setAddingReviewer(!addingReviewer)} className="text-muted-foreground hover:text-primary" title="添加评审者">
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
              </div>
              {addingReviewer && (
                <AccountSearch
                  placeholder="搜索评审者姓名或邮箱..."
                  onSelect={(account) => { handleAddReviewer(account, 'REVIEWER'); setAddingReviewer(false); }}
                  onCancel={() => setAddingReviewer(false)}
                />
              )}
              {change.reviewers?.REVIEWER?.map((r) => (
                <div key={r._account_id} className="flex items-center justify-between group text-xs text-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>{getAccountName(r)}</span>
                  </div>
                  <button onClick={() => handleRemoveReviewer(r._account_id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity" title="移除">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              <div className="flex items-center justify-between mt-3">
                <p className="text-xs font-medium text-muted-foreground">抄送</p>
                <button onClick={() => setAddingCC(!addingCC)} className="text-muted-foreground hover:text-primary" title="添加抄送">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {addingCC && (
                <AccountSearch
                  placeholder="搜索抄送人姓名或邮箱..."
                  onSelect={(account) => { handleAddReviewer(account, 'CC'); setAddingCC(false); }}
                  onCancel={() => setAddingCC(false)}
                />
              )}
              {change.reviewers?.CC?.map((r) => (
                <div key={r._account_id} className="flex items-center justify-between group text-xs text-foreground/70">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>{getAccountName(r)}</span>
                  </div>
                  <button onClick={() => handleRemoveReviewer(r._account_id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity" title="移除">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Change metadata */}
          <Card>
            <CardContent className="p-3 space-y-2 text-xs">
              <p className="font-medium text-muted-foreground">变更信息</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Change-Id</span><span className="font-mono truncate ml-2">{change.change_id?.slice(0, 12)}...</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">创建时间</span><span>{formatGerritDate(change.created)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">更新时间</span><span>{formatGerritDate(change.updated)}</span></div>
              {change.topic && <div className="flex justify-between"><span className="text-muted-foreground">Topic</span><span className="truncate ml-2">{change.topic}</span></div>}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Diff</span>
                <span>
                  <span className="text-green-600">+{totalInsertions}</span>
                  {' / '}
                  <span className="text-red-500">-{totalDeletions}</span>
                  {' · '}
                  {files.length} files
                </span>
              </div>
              {change.submittable !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">可合入</span>
                  <span className={change.submittable ? 'text-green-600' : 'text-muted-foreground'}>
                    {change.submittable ? '是' : '否'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Message Item ────────────────────────────────────────────────────────────

function MessageItem({ message }: { message: GerritMessage }) {
  const isAutogenerated = message.tag?.startsWith('autogenerated:');
  const author = message.author || message.real_author;

  return (
    <div className={cn('px-3 py-2', isAutogenerated && 'bg-muted/30')}>
      <div className="flex items-center gap-2 text-xs mb-1">
        <span className="font-medium text-foreground">{getAccountName(author)}</span>
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
