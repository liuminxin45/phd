import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-cmake';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-yaml';
import type { GerritDiffInfo, GerritCommentInfo, FileEntry } from '@/lib/gerrit/types';
import { getAccountName } from '@/lib/gerrit/helpers';
import { MessageSquare, ChevronDown, ChevronRight, Search, Trash2, Reply, Pencil, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

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

interface PendingCommentData {
  localKey: string;
  line: number;
  message: string;
  in_reply_to?: string;
  unresolved?: boolean;
}

function PendingCommentDisplay({
  comment,
  filePath,
  onEdit,
  onDelete
}: {
  comment: PendingCommentData;
  filePath: string;
  onEdit?: (file: string, localKey: string, newMessage: string, unresolved?: boolean) => void;
  onDelete?: (file: string, localKey: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(comment.message);
  const [unresolved, setUnresolved] = useState(comment.unresolved);

  const handleSave = () => {
    if (onEdit && text.trim()) {
      onEdit(filePath, comment.localKey, text.trim(), unresolved);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="mx-4 my-2 p-3 rounded-lg border border-blue-300 bg-blue-50 shadow-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-100/50">Editing Draft</Badge>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[60px] text-xs resize-y mb-2 bg-white"
          autoFocus
        />
        <label className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Checkbox checked={unresolved} onCheckedChange={(c) => setUnresolved(c === true)} />
          <span>Resolved status (unchecked = resolved)</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-7 text-xs"><X className="h-3 w-3 mr-1" /> Cancel</Button>
          <Button size="sm" onClick={handleSave} className="h-7 text-xs"><Check className="h-3 w-3 mr-1" /> Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 my-2 p-3 rounded-lg border border-blue-200 bg-blue-50/50 shadow-sm transition-all hover:border-blue-300">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-100/50">Draft</Badge>
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
              title="Edit Draft"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(filePath, comment.localKey)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
              title="Delete Draft"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <p className="text-blue-900 text-xs whitespace-pre-wrap leading-relaxed">{comment.message}</p>
      {comment.unresolved !== undefined && (
        <div className="mt-2 text-[10px] text-blue-700/70 flex items-center gap-1">
          <div className={cn("w-1.5 h-1.5 rounded-full", comment.unresolved ? "bg-amber-400" : "bg-emerald-400")} />
          {comment.unresolved ? "Will mark as Unresolved" : "Will mark as Resolved"}
        </div>
      )}
    </div>
  );
}

function InlineComment({
  filePath,
  comment,
  threadReplies,
  displayUnresolved,
  replyTargetId,
  pendingReplies,
  onReply,
  onEditPending,
  onDeletePending,
  onDone,
  onJumpToLine,
}: {
  filePath: string;
  comment: GerritCommentInfo;
  threadReplies?: GerritCommentInfo[];
  displayUnresolved?: boolean;
  replyTargetId?: string;
  pendingReplies?: PendingCommentData[];
  onReply?: (commentId: string, line: number | undefined, message: string, unresolved?: boolean) => void;
  onEditPending?: (file: string, localKey: string, newMessage: string, unresolved?: boolean) => void;
  onDeletePending?: (file: string, localKey: string) => void;
  onDone?: (commentId: string, line: number | undefined) => void;
  onJumpToLine?: (filePath: string, line: number) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [markResolved, setMarkResolved] = useState(false);
  const effectiveUnresolved = displayUnresolved ?? !!comment.unresolved;

  const handleReplySubmit = () => {
    if (!replyText.trim() || !onReply) return;
    onReply(replyTargetId || comment.id, comment.line, replyText.trim(), markResolved ? false : undefined);
    setReplyText('');
    setMarkResolved(false);
    setReplying(false);
  };

  return (
    <div className={cn(
      'mx-4 my-2 p-3 rounded-lg border text-sm shadow-sm transition-all',
      effectiveUnresolved ? 'bg-amber-50/50 border-amber-200' : 'bg-background border-border'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{getAccountName(comment.author)}</span>
          {effectiveUnresolved && <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100 text-amber-700 hover:bg-amber-200 border-none">Unresolved</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {typeof comment.line === 'number' && onJumpToLine && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onJumpToLine(filePath, comment.line as number)}
              className="h-6 px-2 text-[11px] text-muted-foreground"
            >
              L{comment.line}
            </Button>
          )}
          {effectiveUnresolved && onDone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDone(replyTargetId || comment.id, comment.line)}
              className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700"
            >
              DONE
            </Button>
          )}
          {onReply && !replying && (
            <Button variant="ghost" size="sm" onClick={() => setReplying(true)} className="h-6 px-2 text-xs text-muted-foreground">
              <Reply className="h-3 w-3 mr-1" /> Reply
            </Button>
          )}
        </div>
      </div>
      
      <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed text-xs">
        {comment.message}
      </div>

      {threadReplies && threadReplies.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-border/60 space-y-1.5">
          {threadReplies.map((reply) => (
            <div key={reply.id} className="rounded-md bg-background/70 border border-border/60 px-2 py-1.5">
              <div className="text-[10px] font-medium text-muted-foreground mb-1">{getAccountName(reply.author)}</div>
              <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{reply.message}</div>
            </div>
          ))}
        </div>
      )}

      {pendingReplies && pendingReplies.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-blue-200 space-y-2">
          {pendingReplies.map(reply => (
            <PendingCommentDisplay
              key={reply.localKey}
              comment={reply}
              filePath={filePath}
              onEdit={onEditPending}
              onDelete={onDeletePending}
            />
          ))}
        </div>
      )}

      {replying && (
        <div className="mt-3 pt-3 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleReplySubmit(); }
              if (e.key === 'Escape') { setReplying(false); setReplyText(''); }
            }}
            placeholder="Write a reply..."
            className="min-h-[60px] text-xs resize-y mb-2"
            autoFocus
          />
          {effectiveUnresolved && (
            <label className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Checkbox checked={markResolved} onCheckedChange={(checked) => setMarkResolved(checked === true)} />
              <span>Reply 后标记为 resolved</span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setReplying(false); setReplyText(''); setMarkResolved(false); }} className="h-7 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleReplySubmit} disabled={!replyText.trim()} className="h-7 text-xs">Reply</Button>
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
      <td colSpan={3} className="p-0 border-b border-border/50">
        <div className="mx-4 my-2 p-3 rounded-lg border border-primary/20 bg-primary/5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-primary">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Comment on line {line}</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="Type your comment here..."
            className="min-h-[80px] text-xs resize-y bg-background mb-2"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!text.trim()} className="h-7 text-xs">Post Comment</Button>
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
  pendingComments?: PendingCommentData[];
  loading?: boolean;
  onAddComment?: (line: number, message: string) => void;
  onReplyComment?: (commentId: string, line: number | undefined, message: string, unresolved?: boolean) => void;
  onEditPendingComment?: (file: string, localKey: string, newMessage: string, unresolved?: boolean) => void;
  onDoneComment?: (commentId: string, line: number | undefined) => void;
  onDeletePendingComment?: (localKey: string) => void;
}

function getDiffRowTone(type: DiffLine['type']) {
  if (type === 'added') {
    return {
      row: 'hover:brightness-[0.985]',
      oldNumber: 'diff-line-added text-foreground',
      newNumber: 'diff-line-added text-foreground',
      contentCell: 'diff-line-added',
      contentText: 'text-foreground',
    };
  }

  if (type === 'removed') {
    return {
      row: 'hover:brightness-[0.985]',
      oldNumber: 'diff-line-removed text-foreground',
      newNumber: 'diff-line-removed text-foreground',
      contentCell: 'diff-line-removed',
      contentText: 'text-foreground',
    };
  }

  return {
    row: 'hover:bg-muted/30',
    oldNumber: 'text-muted-foreground/40',
    newNumber: 'text-muted-foreground/40',
    contentCell: '',
    contentText: '',
  };
}

function detectPrismLanguage(filePath: string): string {
  const normalized = filePath.toLowerCase();

  if (normalized.endsWith('.tsx')) return 'tsx';
  if (normalized.endsWith('.ts')) return 'typescript';
  if (normalized.endsWith('.jsx')) return 'jsx';
  if (normalized.endsWith('.js') || normalized.endsWith('.mjs') || normalized.endsWith('.cjs')) return 'javascript';
  if (normalized.endsWith('.json')) return 'json';
  if (normalized.endsWith('.yml') || normalized.endsWith('.yaml')) return 'yaml';
  if (normalized.endsWith('.css')) return 'css';
  if (normalized.endsWith('.html') || normalized.endsWith('.htm') || normalized.endsWith('.xml')) return 'markup';
  if (normalized.endsWith('.md')) return 'markdown';
  if (normalized.endsWith('.py')) return 'python';
  if (normalized.endsWith('.java')) return 'java';
  if (normalized.endsWith('.go')) return 'go';
  if (normalized.endsWith('.rs')) return 'rust';
  if (normalized.endsWith('.sh') || normalized.endsWith('.bash')) return 'bash';
  if (normalized.endsWith('.c')) return 'c';
  if (normalized.endsWith('.cc') || normalized.endsWith('.cpp') || normalized.endsWith('.cxx') || normalized.endsWith('.hpp') || normalized.endsWith('.h')) return 'cpp';
  if (normalized.endsWith('cmakelists.txt') || normalized.endsWith('.cmake')) return 'cmake';

  return 'clike';
}

function highlightDiffCode(content: string, filePath: string): string {
  const language = detectPrismLanguage(filePath);
  const grammar = Prism.languages[language] || Prism.languages.clike;
  return Prism.highlight(content, grammar, language);
}

export function DiffViewer({ diff, filePath, comments = [], pendingComments = [], loading, onAddComment, onReplyComment, onEditPendingComment, onDoneComment, onDeletePendingComment }: DiffViewerProps) {
  const [commentingLine, setCommentingLine] = useState<number | null>(null);
  const [expandedSkips, setExpandedSkips] = useState<Set<string>>(new Set());
  const prismLanguage = detectPrismLanguage(filePath);

  useEffect(() => {
    setExpandedSkips(new Set());
  }, [diff, filePath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground bg-muted/5 rounded-lg border border-dashed">
        Loading Diff...
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground bg-muted/5 rounded-lg border border-dashed">
        Diff not available
      </div>
    );
  }

  if (diff.binary) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground bg-muted/5 rounded-lg border border-dashed">
        Binary file shown
      </div>
    );
  }

  const commentsById = new Map<string, GerritCommentInfo>();
  for (const c of comments) {
    commentsById.set(c.id, c);
  }

  const threadsByRoot = new Map<string, GerritCommentInfo[]>();
  for (const c of comments) {
    let rootId = c.id;
    let cursor = c;
    const seen = new Set<string>();
    while (cursor.in_reply_to && commentsById.has(cursor.in_reply_to) && !seen.has(cursor.in_reply_to)) {
      seen.add(cursor.in_reply_to);
      rootId = cursor.in_reply_to;
      cursor = commentsById.get(cursor.in_reply_to)!;
    }
    const existing = threadsByRoot.get(rootId) || [];
    existing.push(c);
    threadsByRoot.set(rootId, existing);
  }

  const threadsByLine = new Map<number, { root: GerritCommentInfo; replies: GerritCommentInfo[]; latest: GerritCommentInfo; unresolved: boolean }[]>();
  for (const [rootId, thread] of threadsByRoot.entries()) {
    const root = commentsById.get(rootId) || thread[0];
    if (!root?.line) continue;
    const sorted = [...thread].sort((a, b) => String(a.updated || '').localeCompare(String(b.updated || '')));
    const latest = sorted[sorted.length - 1] || root;
    const unresolved = typeof latest.unresolved === 'boolean'
      ? latest.unresolved
      : !!root.unresolved;
    const existing = threadsByLine.get(root.line) || [];
    existing.push({
      root,
      replies: sorted.filter((item) => item.id !== root.id),
      latest,
      unresolved,
    });
    threadsByLine.set(root.line, existing);
  }

  for (const threadList of threadsByLine.values()) {
    threadList.sort((a, b) => String(a.root.updated || '').localeCompare(String(b.root.updated || '')));
  }

  const pendingByLine = new Map<number, PendingCommentData[]>();
  const pendingRepliesByRoot = new Map<string, PendingCommentData[]>();

  for (const c of pendingComments) {
    if (c.in_reply_to) {
      let rootId = c.in_reply_to;
      let cursor = commentsById.get(c.in_reply_to);
      const seen = new Set<string>();
      while (cursor?.in_reply_to && commentsById.has(cursor.in_reply_to) && !seen.has(cursor.in_reply_to)) {
        seen.add(cursor.in_reply_to);
        rootId = cursor.in_reply_to;
        cursor = commentsById.get(cursor.in_reply_to);
      }
      const existing = pendingRepliesByRoot.get(rootId) || [];
      existing.push(c);
      pendingRepliesByRoot.set(rootId, existing);
      continue;
    }
    if (!c.line) continue;
    const existing = pendingByLine.get(c.line) || [];
    existing.push(c);
    pendingByLine.set(c.line, existing);
  }

  const emphasizedLines = new Set<number>([
    ...Array.from(threadsByLine.keys()),
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
    const lineThreads = lineNum ? threadsByLine.get(lineNum) : undefined;
    const linePending = lineNum ? pendingByLine.get(lineNum) : undefined;
    const tone = getDiffRowTone(line.type);

    return (
      <React.Fragment key={key}>
        <tr
          className={cn('group transition-colors', tone.row)}
          data-diff-line={lineNum ? `${filePath}:${lineNum}` : undefined}
        >
          {/* Old line number */}
          <td className={cn(
            'w-14 text-right pr-3 pl-2 select-none border-r border-border/40 text-[11px] font-mono',
            tone.oldNumber
          )}>
            {line.oldLine || ''}
          </td>
          {/* New line number — clickable for comments */}
          <td
            className={cn(
              'w-14 text-right pr-3 select-none border-r border-border/40 text-[11px] font-mono transition-colors',
              tone.newNumber,
              onAddComment && lineNum && 'cursor-pointer hover:bg-primary/10 hover:text-primary font-medium'
            )}
            onClick={() => handleLineClick(lineNum)}
            title={onAddComment && lineNum ? `Click to comment on line ${lineNum}` : undefined}
          >
            {line.newLine || ''}
          </td>
          {/* Content */}
          <td className={cn(
            'px-4 py-1 whitespace-pre font-mono text-[13px] leading-6',
            tone.contentCell
          )}>
            <span
              className={cn('diff-code', `language-${prismLanguage}`, tone.contentText)}
              dangerouslySetInnerHTML={{ __html: highlightDiffCode(line.content || ' ', filePath) }}
            />
          </td>
        </tr>
        {/* Existing comments on this line */}
        {lineThreads && lineThreads.map((thread) => (
          <tr key={`${key}-comment-thread-${thread.root.id}`}>
            <td colSpan={3} className="p-0 border-b border-border/50">
              <InlineComment
                filePath={filePath}
                comment={thread.root}
                threadReplies={thread.replies}
                displayUnresolved={thread.unresolved}
                replyTargetId={thread.latest.id}
                pendingReplies={pendingRepliesByRoot.get(thread.root.id)}
                onReply={onReplyComment}
                onEditPending={onEditPendingComment}
                onDeletePending={onDeletePendingComment ? (f, k) => onDeletePendingComment(k) : undefined}
                onDone={onDoneComment}
                onJumpToLine={(jumpFilePath, jumpLine) => {
                  const lineEl = document.querySelector(`[data-diff-line="${jumpFilePath}:${jumpLine}"]`);
                  if (lineEl) {
                    lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    lineEl.classList.add('ring-2', 'ring-blue-400', 'ring-offset-1');
                    setTimeout(() => lineEl.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-1'), 1800);
                  }
                }}
              />
            </td>
          </tr>
        ))}
        {linePending && linePending.map((c) => (
          <tr key={`${key}-pending-${c.localKey}`}>
            <td colSpan={3} className="p-0 border-b border-border/50">
              <PendingCommentDisplay
                comment={c}
                filePath={filePath}
                onEdit={onEditPendingComment}
                onDelete={onDeletePendingComment ? (f, k) => onDeletePendingComment(k) : undefined}
              />
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
    <div className="border rounded-md overflow-hidden bg-card shadow-sm">
      {/* File header */}
      <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center justify-between text-xs">
        <span className="font-mono text-foreground font-medium">{filePath}</span>
        <div className="flex items-center gap-3 font-mono">
          {diff.meta_a && <span className="text-muted-foreground">{diff.meta_a.lines} lines</span>}
          <div className="flex items-center gap-2">
             <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+{lines.filter((l) => l.type === 'added').length}</span>
             <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded">-{lines.filter((l) => l.type === 'removed').length}</span>
          </div>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto bg-white/50">
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
                    className="bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors group"
                    onClick={() => {
                      if (!line.skipId) return;
                      setExpandedSkips((prev) => {
                        const next = new Set(prev);
                        next.add(line.skipId as string);
                        return next;
                      });
                    }}
                    title="Expand hidden lines"
                  >
                    <td colSpan={3} className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                         <ChevronDown className="h-3 w-3" />
                         <span>Show {line.skipCount} hidden lines</span>
                      </div>
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
  onReplyComment?: (commentId: string, line: number | undefined, message: string, unresolved?: boolean) => void;
  onEditPendingComment?: (file: string, localKey: string, newMessage: string, unresolved?: boolean) => void;
  onDoneComment?: (commentId: string, line: number | undefined) => void;
  pendingCommentsByFile?: Record<string, { localKey: string; line: number; message: string; in_reply_to?: string; unresolved?: boolean }[]>;
  onDeletePendingComment?: (filePath: string, localKey: string) => void;
  // Search
  onSearchFile?: (query: string) => void;
  searchExpandedFile?: string | null;
  pendingCommentCounts?: Record<string, number>;
}

export function FileList({
  files, selectedFile, onSelectFile, totalInsertions, totalDeletions,
  currentDiff, loadingDiff, fileComments, onAddComment, onReplyComment, onEditPendingComment, onDoneComment,
  pendingCommentsByFile, onDeletePendingComment,
  onSearchFile, searchExpandedFile, pendingCommentCounts,
}: FileListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [highlightedFile, setHighlightedFile] = useState<string | null>(null);
  const fileHeaderRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const fileDiffRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingScrollFileRef = useRef<string | null>(null);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    onSearchFile?.(searchQuery.trim());
    setSearchActive(true);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchActive(false);
  };

  const handleToggleFile = (path: string, isExpanded: boolean) => {
    onSelectFile(path);
    if (isExpanded) {
      pendingScrollFileRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fileHeaderRefs.current[path]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setHighlightedFile(path);
          window.setTimeout(() => {
            setHighlightedFile((prev) => (prev === path ? null : prev));
          }, 1000);
        });
      });
      return;
    }

    pendingScrollFileRef.current = path;
    setHighlightedFile(path);
  };

  useEffect(() => {
    const targetPath = pendingScrollFileRef.current;
    if (!targetPath || selectedFile !== targetPath || loadingDiff) return;

    const target = fileDiffRefs.current[targetPath] || fileHeaderRefs.current[targetPath];
    if (!target) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => {
          setHighlightedFile((prev) => (prev === targetPath ? null : prev));
        }, 1200);
      });
    });

    pendingScrollFileRef.current = null;
  }, [loadingDiff, selectedFile, currentDiff]);

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-none overflow-hidden">
      {/* Header with search */}
      <div className="space-y-3 border-b border-border/50 bg-muted/[0.02] px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">
            Files ({files.length})
          </span>
          <div className="flex items-center gap-2 text-xs font-mono">
            {totalInsertions !== undefined && <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-600">+{totalInsertions}</span>}
            {totalDeletions !== undefined && <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-500">-{totalDeletions}</span>}
          </div>
        </div>
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') handleClearSearch(); }}
              placeholder="Search file content..."
              className="h-9 w-full rounded-xl border-border/60 bg-background pl-8 text-xs shadow-none"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!searchQuery.trim()}
            size="sm"
            className="h-9 rounded-xl px-3 text-xs shadow-none"
          >
            Search
          </Button>
          {searchActive && (
            <Button variant="ghost" onClick={handleClearSearch} size="sm" className="h-9 rounded-xl px-3 text-xs text-muted-foreground">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* File entries with inline diffs */}
      <div className="divide-y divide-border/50">
        {files.map((file) => {
          const isExpanded = selectedFile === file.path;
          const pendingCount = pendingCommentCounts?.[file.path] || 0;

          return (
            <div key={file.path} className="group">
              {/* File entry row */}
              <button
                ref={(el) => {
                  fileHeaderRefs.current[file.path] = el;
                }}
                onClick={() => handleToggleFile(file.path, isExpanded)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 text-xs text-left transition-colors',
                  isExpanded ? 'sticky top-0 z-20 border-b border-border bg-card shadow-sm' : 'hover:bg-muted/[0.03]',
                  highlightedFile === file.path && 'ring-2 ring-primary/40 bg-primary/10'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />}
                  
                  <Badge variant="outline" className={cn(
                    'shrink-0 w-5 h-5 flex items-center justify-center p-0 font-bold border-none',
                    file.status === 'A' ? 'bg-green-100 text-green-700' :
                    file.status === 'D' ? 'bg-red-100 text-red-700' :
                    file.status === 'R' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  )}>
                    {file.status || 'M'}
                  </Badge>
                  
                  <span className={cn("truncate font-mono", isExpanded ? "font-medium text-primary" : "text-foreground")}>
                    {file.path}
                  </span>
                  
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 shrink-0">
                      {pendingCount} drafts
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-3 shrink-0 ml-4 font-mono text-[10px]">
                  {file.binary ? (
                    <Badge variant="secondary" className="h-4 text-[9px]">Binary</Badge>
                  ) : (
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      {(file.linesInserted || 0) > 0 && <span className="text-green-600">+{file.linesInserted}</span>}
                      {(file.linesDeleted || 0) > 0 && <span className="text-red-500">-{file.linesDeleted}</span>}
                    </div>
                  )}
                </div>
              </button>

              {/* Inline diff (expanded) */}
              {isExpanded && (
                <div
                  ref={(el) => {
                    fileDiffRefs.current[file.path] = el;
                  }}
                  className="border-b border-border/50 animate-in slide-in-from-top-2 duration-200 scroll-mt-24"
                >
                  <DiffViewer
                    diff={currentDiff || null}
                    filePath={file.path}
                    comments={fileComments}
                    pendingComments={pendingCommentsByFile?.[file.path] || []}
                    loading={loadingDiff}
                    onAddComment={onAddComment}
                    onReplyComment={onReplyComment}
                    onEditPendingComment={onEditPendingComment}
                    onDoneComment={onDoneComment}
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
