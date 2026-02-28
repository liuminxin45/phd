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
  CHANGE_TYPE_META,
} from '@/lib/gerrit/ai-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';

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
      ? <mark key={`m-${idx}`} className="bg-amber-200/70 px-0.5 rounded text-amber-900">{part}</mark>
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
      setError(err.message || 'AI Analysis Failed');
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
      <Card className="border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer" onClick={runReview}>
        <CardContent className="p-3 flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          <span>开始 AI 智能评审</span>
        </CardContent>
      </Card>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <div className="flex justify-center">
             <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-sm font-medium">正在分析变更...</p>
          <p className="text-xs text-muted-foreground">正在读取 Diff 并生成结构化分析报告。</p>
        </CardContent>
      </Card>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span>分析失败</span>
          </div>
          <p className="text-xs text-red-600/80">{error}</p>
          <Button variant="outline" size="sm" className="h-7 text-xs bg-white border-red-200 text-red-700 hover:bg-red-100" onClick={runReview}>
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
    <Card className={cn("overflow-hidden", riskMeta.borderColor)}>
      <CardHeader className="px-4 py-3 bg-muted/20 border-b border-border/40">
        <div className="flex items-center justify-between">
           <button
             onClick={() => setIsOpen(!isOpen)}
             className="flex items-center gap-2 font-medium text-sm"
           >
             <Sparkles className="h-4 w-4 text-primary" />
             AI 智能分析
             {result.issues.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">
                  {visibleIssues.length} 个问题
                </Badge>
             )}
           </button>
           <div className="flex items-center gap-1">
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={runReview} title="重新分析">
               <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
             </Button>
             <button
               onClick={() => setIsOpen(!isOpen)}
               className="p-1 hover:bg-muted rounded text-muted-foreground"
             >
               {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
             </button>
           </div>
        </div>
      </CardHeader>

      {isOpen && (
        <div className="bg-card">
          {/* ── 1️⃣ Overview Section ──────────────────────────────────── */}
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Badge variant="outline" className={cn("gap-1.5 pr-2.5", riskMeta.bgColor, riskMeta.textColor, riskMeta.borderColor)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', riskMeta.dotColor)} />
                    {riskMeta.label}
                 </Badge>
                 <span className="text-xs text-muted-foreground">
                   {result.overview.changeTypes.map(t => CHANGE_TYPE_META[t] || t).join(', ')}
                 </span>
              </div>
            </div>

            <p className="text-xs text-foreground/90 leading-relaxed">
              {result.overview.summary}
            </p>

            {result.overview.focusPoints.length > 0 && (
              <div className="space-y-1.5 bg-muted/30 p-2 rounded text-xs">
                <p className="font-medium text-muted-foreground">关键关注点:</p>
                <ul className="space-y-1">
                  {result.overview.focusPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground/80">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Separator />

          {/* ── 2️⃣ Issue Groups ────────────────────────────────────── */}
          {sortedCategories.length > 0 ? (
            <div className="divide-y divide-border/40">
              {sortedCategories.map((category) => {
                const issues = groupedIssues.get(category)!;
                const meta = ISSUE_CATEGORY_META[category];
                const isExpanded = expandedCategories.has(category);
                const highCount = issues.filter((i) => i.severity === 'high').length;

                return (
                  <div key={category}>
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{meta.icon}</span>
                        <span className={cn('text-xs font-medium', meta.color)}>{meta.label}</span>
                        <span className="text-xs text-muted-foreground">({issues.length})</span>
                        {highCount > 0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" title={`${highCount} 个高风险问题`} />
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2">
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
          ) : (
             <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                <span className="block text-xl mb-1">✨</span>
                未发现主要问题
             </div>
          )}
          
          <Separator />

          <div className="px-3 py-2 text-[10px] text-muted-foreground flex justify-between bg-muted/10">
            <span>模型: {result.usedModel || 'Unknown'}</span>
            <span>{new Date(result.generatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </Card>
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
      'rounded-lg border px-3 py-2.5 text-xs transition-all bg-card',
      isDismissed ? 'opacity-50 border-border bg-muted/20' : 'border-border/60 hover:border-border hover:shadow-sm'
    )}>
      {/* Title row */}
      <div className="flex items-start gap-2">
        <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 shrink-0', severityDot.dotColor)} title={issue.severity} />
        
        <div className="flex-1 min-w-0">
          <div 
             className="flex items-start justify-between gap-2 cursor-pointer"
             onClick={() => setShowDetail(!showDetail)}
          >
             <span className="font-medium text-foreground/90 leading-snug">{issue.title}</span>
             {issue.verification && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] px-1 h-4 ml-1 shrink-0',
                    issue.verification.status === 'confirmed' && 'text-green-600 border-green-200 bg-green-50',
                    issue.verification.status === 'uncertain' && 'text-amber-600 border-amber-200 bg-amber-50',
                    issue.verification.status === 'rejected' && 'text-red-600 border-red-200 bg-red-50'
                  )}
                >
                  {issue.verification.status === 'confirmed' ? '已确认' : issue.verification.status === 'uncertain' ? '存疑' : '已驳回'}
                </Badge>
              )}
          </div>
          
          {/* File location */}
          {issue.file && (
             <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-muted-foreground/70 font-mono truncate max-w-[180px]" title={issue.file}>
                   {issue.file}
                </span>
                {issue.line && onJumpToLine && (
                   <button
                     onClick={(e) => { e.stopPropagation(); onJumpToLine(issue.file!, issue.line!); }}
                     className="text-[10px] text-primary hover:underline font-mono"
                   >
                     :L{issue.line}
                   </button>
                )}
             </div>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {showDetail && (
        <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
          <p className="text-muted-foreground leading-relaxed">{issue.description}</p>
          
          {issue.suggestion && (
            <div className="bg-blue-50/50 border border-blue-100 rounded p-2">
              <p className="text-[10px] font-medium text-blue-700 mb-0.5">建议修复</p>
              <p className="text-xs text-blue-900">{issue.suggestion}</p>
            </div>
          )}

          {issue.evidence?.snippet && (
            <div className="rounded border bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium">相关代码</p>
              <pre className="text-[10px] text-foreground/80 font-mono break-all whitespace-pre-wrap">{highlightedEvidence}</pre>
            </div>
          )}
          
          {issue.verification?.reason && (
            <p className="text-[10px] text-muted-foreground italic">复核说明: {issue.verification.reason}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 pt-1">
            <FeedbackButton
              active={feedback === 'helpful'}
              onClick={() => onFeedback(issue, 'helpful')}
              icon={<ThumbsUp className="h-3 w-3" />}
              activeColor="text-green-600 bg-green-50"
              title="有用"
            />
            <FeedbackButton
              active={feedback === 'false-positive'}
              onClick={() => onFeedback(issue, 'false-positive')}
              icon={<ThumbsDown className="h-3 w-3" />}
              activeColor="text-red-500 bg-red-50"
              title="误报"
            />
            <FeedbackButton
              active={feedback === 'dismissed'}
              onClick={() => onFeedback(issue, 'dismissed')}
              icon={<X className="h-3 w-3" />}
              activeColor="text-neutral-500 bg-neutral-100"
              title="忽略"
            />
            
            {issue.file && issue.line && onAddDraftComment && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-6 text-[10px] gap-1 px-2"
                onClick={() => onAddDraftComment(
                  issue.file as string,
                  issue.line as number,
                  `[AI 建议] ${issue.title}\n\n${issue.suggestion || issue.description}`
                )}
              >
                <Plus className="h-3 w-3" />
                引用评论
              </Button>
            )}
          </div>
        </div>
      )}
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
        'p-1.5 rounded transition-colors',
        active
          ? activeColor
          : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted'
      )}
    >
      {icon}
    </button>
  );
}
