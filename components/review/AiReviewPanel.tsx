import { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { httpPost } from '@/lib/httpClient';
import type {
  AiReviewResult,
  AiIssue,
  AiFeedbackEntry,
  IssueCategory,
  FeedbackValue,
} from '@/lib/gerrit/ai-types';
import {
  ISSUE_CATEGORY_META,
  RISK_LEVEL_META,
} from '@/lib/gerrit/ai-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  X,
  AlertTriangle,
  RefreshCw,
  Plus,
} from 'lucide-react';

// ─── Feedback persistence (localStorage) ────────────────────────────────────

const FEEDBACK_KEY = 'ai-review-feedback';
const FEEDBACK_HISTORY_KEY = 'ai-review-feedback-history';
const RESULT_CACHE_KEY = 'ai-review-result-cache';

function buildReviewCacheKey(changeNumber: number, revisionId?: string, baseRevisionId?: string): string {
  return `${changeNumber}:${revisionId || 'current'}:${baseRevisionId || 'parent'}`;
}

function highlightSnippet(snippet: string, issueTitle: string): React.ReactNode {
  if (!snippet) return snippet;

  const keywords = Array.from(new Set(
    issueTitle
      .split(/[\s,.;:()\[\]{}'"/\\|!?`~+-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
  )).slice(0, 6);

  if (keywords.length === 0) return snippet;

  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const keywordRegex = new RegExp(`^(?:${escaped.join('|')})$`, 'i');
  const parts = snippet.split(regex);

  return parts.map((part, idx) => (
    keywordRegex.test(part)
      ? <mark key={`m-${idx}`} className="bg-amber-200/70 px-0.5 rounded">{part}</mark>
      : <span key={`t-${idx}`}>{part}</span>
  ));
}

function loadFeedbackHistory(): AiFeedbackEntry[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendFeedbackHistory(entry: AiFeedbackEntry) {
  try {
    const existing = loadFeedbackHistory();
    const next = [...existing, entry].slice(-200);
    localStorage.setItem(FEEDBACK_HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

function loadFeedback(): Record<string, FeedbackValue> {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFeedback(issueId: string, value: FeedbackValue) {
  try {
    const existing = loadFeedback();
    existing[issueId] = value;
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(existing));
  } catch {}
}

function loadReviewResultCache(): Record<string, AiReviewResult> {
  try {
    const raw = localStorage.getItem(RESULT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveReviewResultCache(cacheKey: string, result: AiReviewResult) {
  try {
    const existing = loadReviewResultCache();
    existing[cacheKey] = result;
    localStorage.setItem(RESULT_CACHE_KEY, JSON.stringify(existing));
  } catch {}
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface AiReviewPanelProps {
  changeNumber: number;
  revisionId?: string;
  baseRevisionId?: string;
  onJumpToLine?: (file: string, line: number) => void;
  onAddDraftComment?: (file: string, line: number, message: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AiReviewPanel({
  changeNumber,
  revisionId,
  baseRevisionId,
  onJumpToLine,
  onAddDraftComment,
}: AiReviewPanelProps) {
  const [result, setResult] = useState<AiReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<IssueCategory>>(new Set());
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackValue>>({});

  const visibleIssues = useMemo(() => (result?.issues || []), [result?.issues]);

  // Load persisted feedback on mount
  useEffect(() => {
    setFeedbackMap(loadFeedback());
  }, []);

  useEffect(() => {
    const cacheKey = buildReviewCacheKey(changeNumber, revisionId, baseRevisionId);
    const cached = loadReviewResultCache()[cacheKey];
    if (cached) {
      setResult(cached);
      setError(null);
      return;
    }
    setResult(null);
  }, [changeNumber, revisionId, baseRevisionId]);

  const runReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpPost<AiReviewResult>('/api/gerrit/ai-review', {
        changeNumber,
        revisionId,
        baseRevisionId,
        feedbackEntries: loadFeedbackHistory().slice(-40),
      });
      setResult(res);
      saveReviewResultCache(buildReviewCacheKey(changeNumber, revisionId, baseRevisionId), res);
      setIsOpen(true);
      // Auto-expand categories with high-severity issues
      const autoExpand = new Set<IssueCategory>();
      for (const issue of res.issues) {
        if (issue.severity === 'high') autoExpand.add(issue.category);
      }
      setExpandedCategories(autoExpand);
    } catch (err: any) {
      setError(err.message || 'AI 分析失败');
    } finally {
      setLoading(false);
    }
  }, [baseRevisionId, changeNumber, revisionId]);

  const handleFeedback = useCallback((issue: AiIssue, value: FeedbackValue) => {
    const issueId = issue.id;
    setFeedbackMap((prev) => ({ ...prev, [issueId]: value }));
    saveFeedback(issueId, value);
    appendFeedbackHistory({
      issueId,
      changeNumber,
      revisionId,
      baseRevisionId,
      value,
      category: issue.category,
      severity: issue.severity,
      title: issue.title,
      file: issue.file,
      line: issue.line,
      timestamp: new Date().toISOString(),
    });
  }, [baseRevisionId, changeNumber, revisionId]);

  const toggleCategory = (cat: IssueCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // ── Not yet triggered ─────────────────────────────────────────────────────
  if (!isOpen && !result && !loading && !error) {
    return (
      <Card className="border-dashed border-slate-300/60">
        <CardContent className="p-3">
          <button
            onClick={runReview}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI 辅助分析</span>
          </button>
        </CardContent>
      </Card>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>AI 正在分析变更...</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground/60">
            正在读取 diff 并生成结构化分析，通常需要 10-30 秒
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <Card className="border-red-200/60">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>AI 分析失败</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={runReview}>
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const groupedIssues = new Map<IssueCategory, AiIssue[]>();
  for (const issue of visibleIssues) {
    const existing = groupedIssues.get(issue.category) || [];
    existing.push(issue);
    groupedIssues.set(issue.category, existing);
  }

  // Sort categories: bug → performance → maintainability → style
  const categoryOrder: IssueCategory[] = ['bug', 'performance', 'maintainability', 'style'];
  const sortedCategories = categoryOrder.filter((c) => groupedIssues.has(c));

  const riskMeta = RISK_LEVEL_META[result.overview.riskLevel];

  return (
    <div className="space-y-3">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Card className="border-slate-200/80">
        <CardContent className="p-0">
          <div className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 text-left"
              type="button"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-foreground">AI 分析</span>
              <span className={cn('h-2 w-2 rounded-full', riskMeta.dotColor)} title={riskMeta.label} />
            </button>
            <div className="flex items-center gap-1.5">
              {result.issues.length > 0 && (
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {visibleIssues.length}/{result.issues.length}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={runReview}
                title="重新分析"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center"
                type="button"
                title={isOpen ? '收起' : '展开'}
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            </div>
          </div>

          {isOpen && (
            <div className="border-t border-border">
              {/* ── 1️⃣ Overview Section ──────────────────────────────────── */}
              <div className="px-3 py-3 space-y-2.5">
                {/* Risk badge */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                    riskMeta.bgColor, riskMeta.textColor
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', riskMeta.dotColor)} />
                    {riskMeta.label}
                  </span>
                  {result.overview.changeTypes.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px] text-muted-foreground">
                      {t}
                    </Badge>
                  ))}
                </div>

                {/* Summary */}
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {result.overview.summary}
                </p>

                {/* Focus points */}
                {result.overview.focusPoints.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">建议关注：</p>
                    {result.overview.focusPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
                        <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 2️⃣ Issue Groups (collapsed by default) ──────────────── */}
              {sortedCategories.length > 0 && (
                <div className="border-t border-border">
                  {sortedCategories.map((category) => {
                    const issues = groupedIssues.get(category)!;
                    const meta = ISSUE_CATEGORY_META[category];
                    const isExpanded = expandedCategories.has(category);
                    const highCount = issues.filter((i) => i.severity === 'high').length;

                    return (
                      <div key={category} className="border-b border-border last:border-b-0">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{meta.icon}</span>
                            <span className={cn('text-xs font-medium', meta.color)}>{meta.label}</span>
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              {issues.length}
                            </Badge>
                            {highCount > 0 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-2 space-y-1.5">
                            {issues.map((issue) => (
                              <IssueItem
                                key={issue.id}
                                issue={issue}
                                feedback={feedbackMap[issue.id]}
                                onFeedback={handleFeedback}
                                onJumpToLine={onJumpToLine}
                                onAddDraftComment={onAddDraftComment}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* No issues */}
              {visibleIssues.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground border-t border-border">
                  ✨ AI 未发现明显问题
                </div>
              )}

              {/* Timestamp & runtime model */}
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground/50 border-t border-border flex items-center justify-between gap-2">
                <span>生成于 {new Date(result.generatedAt).toLocaleTimeString()}</span>
                <span className="truncate" title={result.usedModel ? `本次实际使用模型：${result.usedModel}` : '本次实际使用模型：未提供'}>
                  本次模型：{result.usedModel || '未提供'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Issue Item ─────────────────────────────────────────────────────────────

function IssueItem({
  issue,
  feedback,
  onFeedback,
  onJumpToLine,
  onAddDraftComment,
}: {
  issue: AiIssue;
  feedback?: FeedbackValue;
  onFeedback: (issue: AiIssue, value: FeedbackValue) => void;
  onJumpToLine?: (file: string, line: number) => void;
  onAddDraftComment?: (file: string, line: number, message: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const isDismissed = feedback === 'dismissed' || feedback === 'false-positive';
  const severityDot = RISK_LEVEL_META[issue.severity];

  const highlightedEvidence = useMemo(
    () => highlightSnippet(issue.evidence?.snippet || '', issue.title),
    [issue.evidence?.snippet, issue.title]
  );

  return (
    <div className={cn(
      'rounded-md border px-2.5 py-2 text-xs transition-opacity',
      isDismissed ? 'opacity-40 border-border' : 'border-border/60 bg-slate-50/50'
    )}>
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="flex items-start gap-1.5 text-left min-w-0 flex-1"
        >
          <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 shrink-0', severityDot.dotColor)} />
          <span className="text-foreground/80 leading-relaxed">{issue.title}</span>
        </button>

        {issue.verification && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] mr-1',
              issue.verification.status === 'confirmed' && 'text-green-600 border-green-200',
              issue.verification.status === 'uncertain' && 'text-amber-600 border-amber-200',
              issue.verification.status === 'rejected' && 'text-red-600 border-red-200'
            )}
          >
            {issue.verification.status === 'confirmed' ? '复核通过' : issue.verification.status === 'uncertain' ? '待确认' : '复核驳回'}
          </Badge>
        )}

        {/* Jump to line */}
        {issue.file && issue.line && onJumpToLine && (
          <button
            onClick={() => onJumpToLine(issue.file!, issue.line!)}
            className="shrink-0 text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 mt-0.5"
            title={`${issue.file}:${issue.line}`}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            <span>L{issue.line}</span>
          </button>
        )}
      </div>

      {/* Expanded detail */}
      {showDetail && (
        <div className="mt-2 pt-2 border-t border-border/40 space-y-1.5">
          <p className="text-muted-foreground leading-relaxed">{issue.description}</p>
          {issue.evidence?.snippet && (
            <div className="rounded border border-amber-200 bg-amber-50/70 px-2 py-1.5">
              <p className="text-[10px] text-amber-700 mb-0.5">证据片段</p>
              <p className="text-[11px] text-foreground/80 font-mono break-all">{highlightedEvidence}</p>
            </div>
          )}
          {issue.verification?.reason && (
            <p className="text-[10px] text-muted-foreground/80">复核说明：{issue.verification.reason}</p>
          )}
          {issue.suggestion && (
            <div className="bg-blue-50/50 border border-blue-100 rounded px-2 py-1.5">
              <p className="text-[11px] text-blue-700">💡 {issue.suggestion}</p>
            </div>
          )}
          {issue.file && (
            <p className="text-[10px] text-muted-foreground/60 font-mono truncate">
              {issue.file}{issue.line ? `:${issue.line}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Feedback buttons */}
      <div className="flex items-center gap-1 mt-1.5">
        <FeedbackButton
          active={feedback === 'helpful'}
          onClick={() => onFeedback(issue, 'helpful')}
          icon={<ThumbsUp className="h-2.5 w-2.5" />}
          activeColor="text-green-600"
          title="有帮助"
        />
        <FeedbackButton
          active={feedback === 'false-positive'}
          onClick={() => onFeedback(issue, 'false-positive')}
          icon={<ThumbsDown className="h-2.5 w-2.5" />}
          activeColor="text-red-500"
          title="误报"
        />
        <FeedbackButton
          active={feedback === 'dismissed'}
          onClick={() => onFeedback(issue, 'dismissed')}
          icon={<X className="h-2.5 w-2.5" />}
          activeColor="text-neutral-500"
          title="忽略"
        />
        {issue.file && issue.line && onAddDraftComment && (
          <button
            onClick={() => onAddDraftComment(
              issue.file as string,
              issue.line as number,
              `${issue.title}\n${issue.suggestion || issue.description}`
            )}
            className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50"
            title="加入待提交评论"
          >
            <Plus className="h-2.5 w-2.5" />
            加入草稿
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Feedback Button ────────────────────────────────────────────────────────

function FeedbackButton({
  active,
  onClick,
  icon,
  activeColor,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  activeColor: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1 rounded transition-colors',
        active
          ? activeColor
          : 'text-muted-foreground/40 hover:text-muted-foreground'
      )}
    >
      {icon}
    </button>
  );
}
