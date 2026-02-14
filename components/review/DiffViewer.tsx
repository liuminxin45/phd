import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { GerritDiffInfo, GerritCommentInfo, FileEntry } from '@/lib/gerrit/types';
import { getAccountName } from '@/lib/gerrit/helpers';
import { MessageSquare, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Diff Line Types ─────────────────────────────────────────────────────────

interface DiffLine {
  type: 'context' | 'added' | 'removed' | 'skip';
  oldLine?: number;
  newLine?: number;
  content: string;
  skipCount?: number;
  skipId?: string;
  hiddenLines?: DiffLine[];
}

const CONTEXT_LINES = 5;
const COMMENT_CONTEXT_LINES = 2;

function buildDiffLines(diff: GerritDiffInfo, emphasizedNewLines: Set<number>): DiffLine[] {
  // First pass: build all lines
  const allLines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const chunk of diff.content) {
    if (chunk.skip) {
      // Gerrit-native skip
      for (let i = 0; i < chunk.skip; i++) {
        allLines.push({ type: 'context', oldLine, newLine, content: '' });
        oldLine++;
        newLine++;
      }
      continue;
    }

    if (chunk.ab) {
      for (const line of chunk.ab) {
        allLines.push({ type: 'context', oldLine, newLine, content: line });
        oldLine++;
        newLine++;
      }
    }

    if (chunk.a) {
      for (const line of chunk.a) {
        allLines.push({ type: 'removed', oldLine, content: line });
        oldLine++;
      }
    }

    if (chunk.b) {
      for (const line of chunk.b) {
        allLines.push({ type: 'added', newLine, content: line });
        newLine++;
      }
    }
  }

  // Second pass: mark which lines are near a change (added/removed)
  const keep = new Uint8Array(allLines.length);
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].type === 'added' || allLines[i].type === 'removed') {
      for (let j = Math.max(0, i - CONTEXT_LINES); j <= Math.min(allLines.length - 1, i + CONTEXT_LINES); j++) {
        keep[j] = 1;
      }
    }
  }

  // Keep commented/draft lines and nearby context visible even if they are away from changes
  if (emphasizedNewLines.size > 0) {
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      if (!line.newLine || !emphasizedNewLines.has(line.newLine)) continue;
      for (let j = Math.max(0, i - COMMENT_CONTEXT_LINES); j <= Math.min(allLines.length - 1, i + COMMENT_CONTEXT_LINES); j++) {
        keep[j] = 1;
      }
    }
  }

  // Third pass: build output with skip markers for collapsed regions
  const result: DiffLine[] = [];
  let i = 0;
  while (i < allLines.length) {
    if (keep[i]) {
      result.push(allLines[i]);
      i++;
    } else {
      // Count consecutive skipped context lines
      let skipStart = i;
      while (i < allLines.length && !keep[i]) i++;
      const skipped = i - skipStart;
      if (skipped > 0) {
        result.push({
          type: 'skip',
          content: '',
          skipCount: skipped,
          skipId: `skip-${skipStart}-${i}`,
          hiddenLines: allLines.slice(skipStart, i),
        });
      }
    }
  }

  return result;
}

// ─── Inline Comment Display (with Reply) ────────────────────────────────────

function InlineComment({ comment, onReply }: { comment: GerritCommentInfo; onReply?: (commentId: string, line: number | undefined, message: string) => void }) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReplySubmit = () => {
    if (!replyText.trim() || !onReply) return;
    onReply(comment.id, comment.line, replyText.trim());
    setReplyText('');
    setReplying(false);
  };

  return (
    <div className={cn(
      'mx-2 my-1 p-2 rounded-md text-xs border',
      comment.unresolved ? 'bg-amber-50 border-amber-200' : 'bg-muted/50 border-border'
    )}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-foreground">{getAccountName(comment.author)}</span>
        {comment.unresolved && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">未解决</Badge>}
        {onReply && !replying && (
          <button onClick={() => setReplying(true)} className="ml-auto text-[10px] text-muted-foreground hover:text-primary transition-colors">回复</button>
        )}
      </div>
      <p className="text-muted-foreground whitespace-pre-wrap">{comment.message}</p>
      {replying && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleReplySubmit(); }
              if (e.key === 'Escape') { setReplying(false); setReplyText(''); }
            }}
            placeholder="回复评论..."
            className="w-full min-h-[40px] p-1.5 rounded border border-border bg-background text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <div className="flex justify-end gap-1 mt-1">
            <button onClick={() => { setReplying(false); setReplyText(''); }} className="px-2 py-0.5 text-[10px] rounded border border-border text-muted-foreground hover:bg-muted">取消</button>
            <button onClick={handleReplySubmit} disabled={!replyText.trim()} className="px-2 py-0.5 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">回复</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline Comment Input ────────────────────────────────────────────────────

function InlineCommentInput({ line, onSubmit, onCancel }: {
  line: number;
  onSubmit: (line: number, message: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(line, text.trim());
    setText('');
  };
  return (
    <tr>
      <td colSpan={3} className="p-0">
        <div className="mx-2 my-1 p-2 rounded-md border border-primary/40 bg-primary/5">
          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>评论第 {line} 行</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="写下评审意见..."
            className="w-full min-h-[50px] p-2 rounded border border-border bg-background text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button onClick={onCancel} className="px-2 py-1 text-[11px] rounded border border-border text-muted-foreground hover:bg-muted">取消</button>
            <button onClick={handleSubmit} disabled={!text.trim()} className="px-2 py-1 text-[11px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">提交</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Main DiffViewer ─────────────────────────────────────────────────────────

interface DiffViewerProps {
  diff: GerritDiffInfo | null;
  filePath: string;
  comments?: GerritCommentInfo[];
  pendingComments?: { localKey: string; line: number; message: string; in_reply_to?: string }[];
  loading?: boolean;
  onAddComment?: (line: number, message: string) => void;
  onReplyComment?: (commentId: string, line: number | undefined, message: string) => void;
  onDeletePendingComment?: (localKey: string) => void;
}

export function DiffViewer({ diff, filePath, comments = [], pendingComments = [], loading, onAddComment, onReplyComment, onDeletePendingComment }: DiffViewerProps) {
  const [commentingLine, setCommentingLine] = useState<number | null>(null);
  const [expandedSkips, setExpandedSkips] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedSkips(new Set());
  }, [diff, filePath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        加载 Diff 中...
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        无法加载 Diff
      </div>
    );
  }

  if (diff.binary) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        二进制文件，无法显示 Diff
      </div>
    );
  }

  // Index comments by line number (for new-side comments)
  const commentsByLine = new Map<number, GerritCommentInfo[]>();
  for (const c of comments) {
    if (c.line) {
      const existing = commentsByLine.get(c.line) || [];
      existing.push(c);
      commentsByLine.set(c.line, existing);
    }
  }

  const pendingByLine = new Map<number, { localKey: string; line: number; message: string; in_reply_to?: string }[]>();
  for (const c of pendingComments) {
    if (!c.line || c.in_reply_to) continue;
    const existing = pendingByLine.get(c.line) || [];
    existing.push(c);
    pendingByLine.set(c.line, existing);
  }

  const emphasizedLines = new Set<number>([
    ...Array.from(commentsByLine.keys()),
    ...Array.from(pendingByLine.keys()),
  ]);
  const lines = buildDiffLines(diff, emphasizedLines);

  const handleLineClick = (lineNum: number | undefined) => {
    if (!lineNum || !onAddComment) return;
    setCommentingLine(commentingLine === lineNum ? null : lineNum);
  };

  const handleCommentSubmit = (line: number, message: string) => {
    onAddComment?.(line, message);
    setCommentingLine(null);
  };

  const renderDiffRow = (line: DiffLine, key: string) => {
    const lineNum = line.newLine;
    const lineComments = lineNum ? commentsByLine.get(lineNum) : undefined;
    const linePending = lineNum ? pendingByLine.get(lineNum) : undefined;

    return (
      <React.Fragment key={key}>
        <tr className="group" data-diff-line={lineNum ? `${filePath}:${lineNum}` : undefined}>
          {/* Old line number */}
          <td className={cn(
            'w-12 text-right pr-2 pl-2 select-none border-r',
            line.type === 'added' ? 'bg-green-50' :
            line.type === 'removed' ? 'bg-red-50 text-red-400' :
            'text-muted-foreground/50'
          )}>
            {line.oldLine || ''}
          </td>
          {/* New line number — clickable for comments */}
          <td
            className={cn(
              'w-12 text-right pr-2 select-none border-r',
              line.type === 'added' ? 'bg-green-50 text-green-500' :
              line.type === 'removed' ? 'bg-red-50' :
              'text-muted-foreground/50',
              onAddComment && lineNum && 'cursor-pointer hover:bg-primary/10 hover:text-primary'
            )}
            onClick={() => handleLineClick(lineNum)}
            title={onAddComment && lineNum ? `点击在第 ${lineNum} 行添加评论` : undefined}
          >
            {line.newLine || ''}
          </td>
          {/* Content */}
          <td className={cn(
            'px-3 whitespace-pre',
            line.type === 'added' && 'bg-green-50/80',
            line.type === 'removed' && 'bg-red-50/80'
          )}>
            <span className={cn(
              line.type === 'added' && 'text-green-800',
              line.type === 'removed' && 'text-red-700'
            )}>
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}{line.content}
            </span>
          </td>
        </tr>
        {/* Existing comments on this line */}
        {lineComments && lineComments.map((c) => (
          <tr key={`${key}-comment-${c.id}`}>
            <td colSpan={3} className="p-0">
              <InlineComment comment={c} onReply={onReplyComment} />
            </td>
          </tr>
        ))}
        {linePending && linePending.map((c) => (
          <tr key={`${key}-pending-${c.localKey}`}>
            <td colSpan={3} className="p-0">
              <div className="mx-2 my-1 p-2 rounded-md text-xs border border-blue-200 bg-blue-50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">草稿</Badge>
                  {onDeletePendingComment && (
                    <button
                      onClick={() => onDeletePendingComment(c.localKey)}
                      className="ml-auto text-[10px] text-blue-700 hover:text-red-600"
                    >
                      删除
                    </button>
                  )}
                </div>
                <p className="text-blue-900 whitespace-pre-wrap">{c.message}</p>
              </div>
            </td>
          </tr>
        ))}
        {/* Inline comment input */}
        {commentingLine === lineNum && lineNum && (
          <InlineCommentInput
            line={lineNum}
            onSubmit={handleCommentSubmit}
            onCancel={() => setCommentingLine(null)}
          />
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* File header */}
      <div className="px-3 py-2 bg-muted/50 border-b text-xs font-mono text-muted-foreground flex items-center justify-between">
        <span>{filePath}</span>
        <div className="flex items-center gap-3">
          {diff.meta_a && <span>{diff.meta_a.lines} lines</span>}
          <span className="text-green-600">+{lines.filter((l) => l.type === 'added').length}</span>
          <span className="text-red-500">-{lines.filter((l) => l.type === 'removed').length}</span>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto text-xs font-mono leading-5">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              if (line.type === 'skip') {
                const isExpanded = !!line.skipId && expandedSkips.has(line.skipId);
                if (isExpanded && line.hiddenLines) {
                  return line.hiddenLines.map((hiddenLine, hiddenIdx) =>
                    renderDiffRow(hiddenLine, `expanded-${line.skipId}-${hiddenIdx}`)
                  );
                }

                return (
                  <tr
                    key={line.skipId || idx}
                    className="bg-blue-50/50 cursor-pointer hover:bg-blue-100/50 transition-colors"
                    onClick={() => {
                      if (!line.skipId) return;
                      setExpandedSkips((prev) => {
                        const next = new Set(prev);
                        next.add(line.skipId as string);
                        return next;
                      });
                    }}
                    title="点击展开省略行"
                  >
                    <td colSpan={3} className="px-3 py-1 text-center text-blue-500 text-[11px]">
                      ··· 省略 {line.skipCount} 行（点击展开）···
                    </td>
                  </tr>
                );
              }

              return renderDiffRow(line, `line-${idx}`);
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── File List with Inline Accordion Diffs + Search ─────────────────────────

interface FileListProps {
  files: FileEntry[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  totalInsertions?: number;
  totalDeletions?: number;
  // Diff data for the currently expanded file
  currentDiff?: GerritDiffInfo | null;
  loadingDiff?: boolean;
  fileComments?: GerritCommentInfo[];
  onAddComment?: (line: number, message: string) => void;
  onReplyComment?: (commentId: string, line: number | undefined, message: string) => void;
  pendingCommentsByFile?: Record<string, { localKey: string; line: number; message: string; in_reply_to?: string }[]>;
  onDeletePendingComment?: (filePath: string, localKey: string) => void;
  // Search
  onSearchFile?: (query: string) => void;
  searchExpandedFile?: string | null;
  pendingCommentCounts?: Record<string, number>;
}

export function FileList({
  files, selectedFile, onSelectFile, totalInsertions, totalDeletions,
  currentDiff, loadingDiff, fileComments, onAddComment, onReplyComment,
  pendingCommentsByFile, onDeletePendingComment,
  onSearchFile, searchExpandedFile, pendingCommentCounts,
}: FileListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    onSearchFile?.(searchQuery.trim());
    setSearchActive(true);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchActive(false);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header with search */}
      <div className="px-3 py-2 bg-muted/50 border-b space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            文件列表 ({files.length})
          </span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {totalInsertions !== undefined && <span className="text-green-600 font-medium">+{totalInsertions}</span>}
            {totalDeletions !== undefined && <span className="text-red-500 font-medium">-{totalDeletions}</span>}
          </div>
        </div>
        {/* Search bar */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') handleClearSearch(); }}
              placeholder="搜索文件内容..."
              className="w-full pl-7 pr-2 py-1 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim()}
            className="px-2 py-1 text-[11px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
          >
            搜索
          </button>
          {searchActive && (
            <button onClick={handleClearSearch} className="px-2 py-1 text-[11px] rounded border border-border text-muted-foreground hover:bg-muted shrink-0">
              清除
            </button>
          )}
        </div>
      </div>

      {/* File entries with inline diffs */}
      <div>
        {files.map((file) => {
          const isExpanded = selectedFile === file.path;
          const pendingCount = pendingCommentCounts?.[file.path] || 0;

          return (
            <div key={file.path}>
              {/* File entry row */}
              <button
                onClick={() => onSelectFile(file.path)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left border-b border-border',
                  isExpanded && 'bg-primary/5 border-l-2 border-l-primary sticky top-0 z-20 shadow-sm'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  <span className={cn(
                    'shrink-0 font-medium w-4 text-center',
                    file.status === 'A' ? 'text-green-600' :
                    file.status === 'D' ? 'text-red-600' :
                    file.status === 'R' ? 'text-blue-600' :
                    'text-amber-600'
                  )}>
                    {file.status || 'M'}
                  </span>
                  <span className="truncate font-mono text-foreground">{file.path}</span>
                  {pendingCount > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-600 border-amber-300 shrink-0">{pendingCount} 待发</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {file.binary ? (
                    <span className="text-muted-foreground">binary</span>
                  ) : (
                    <>
                      {(file.linesInserted || 0) > 0 && <span className="text-green-600">+{file.linesInserted}</span>}
                      {(file.linesDeleted || 0) > 0 && <span className="text-red-500">-{file.linesDeleted}</span>}
                    </>
                  )}
                </div>
              </button>

              {/* Inline diff (expanded) */}
              {isExpanded && (
                <div className="border-b border-border">
                  <DiffViewer
                    diff={currentDiff || null}
                    filePath={file.path}
                    comments={fileComments}
                    pendingComments={pendingCommentsByFile?.[file.path] || []}
                    loading={loadingDiff}
                    onAddComment={onAddComment}
                    onReplyComment={onReplyComment}
                    onDeletePendingComment={(localKey) => onDeletePendingComment?.(file.path, localKey)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
