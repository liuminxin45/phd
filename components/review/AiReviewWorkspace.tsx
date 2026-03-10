import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { cn } from '@/lib/utils';
import { httpGet, httpPost } from '@/lib/httpClient';
import type {
  AiFeedbackEntry,
  AiIssue,
  AiReviewResult,
  AiTeamRules,
  FeedbackValue,
  IssueCategory,
} from '@/lib/gerrit/ai-types';
import {
  CHANGE_TYPE_META,
  DEFAULT_TEAM_RULES,
  ISSUE_CATEGORY_META,
  RISK_LEVEL_META,
} from '@/lib/gerrit/ai-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';

const FEEDBACK_KEY = 'ai-review-feedback';
const FEEDBACK_HISTORY_KEY = 'ai-review-feedback-history';
const RESULT_CACHE_KEY = 'ai-review-result-cache';

function buildReviewCacheKey(changeNumber: number, revisionId?: string, baseRevisionId?: string) {
  return `${changeNumber}:${revisionId || 'current'}:${baseRevisionId || 'parent'}`;
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
    const next = [...loadFeedbackHistory(), entry].slice(-200);
    localStorage.setItem(FEEDBACK_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
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
  } catch {
    // ignore
  }
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
  } catch {
    // ignore
  }
}

function highlightSnippet(snippet: string, issueTitle: string): ReactNode {
  if (!snippet) return snippet;

  const keywords = Array.from(new Set(
    issueTitle
      .split(/[\s,.;:()\[\]{}'"/\\|!?`~+-]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2)
  )).slice(0, 6);

  if (keywords.length === 0) return snippet;

  const escaped = keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const keywordRegex = new RegExp(`^(?:${escaped.join('|')})$`, 'i');
  const parts = snippet.split(regex);

  return parts.map((part, idx) => (
    keywordRegex.test(part)
      ? <mark key={`m-${idx}`} className="rounded bg-amber-200/70 px-0.5 text-amber-900">{part}</mark>
      : <span key={`t-${idx}`}>{part}</span>
  ));
}

type Step = 'config' | 'result';

interface AiReviewWorkspaceProps {
  changeNumber: number;
  revisionId?: string;
  baseRevisionId?: string;
  onJumpToLine?: (file: string, line: number) => void;
  onAddDraftComment?: (file: string, line: number, message: string) => void;
}

export function AiReviewWorkspace({
  changeNumber,
  revisionId,
  baseRevisionId,
  onJumpToLine,
  onAddDraftComment,
}: AiReviewWorkspaceProps) {
  const [step, setStep] = useState<Step>('config');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedRules, setSavedRules] = useState<AiTeamRules>({ ...DEFAULT_TEAM_RULES });
  const [customInstructionEnabled, setCustomInstructionEnabled] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [focusInput, setFocusInput] = useState('');
  const [ignoreInput, setIgnoreInput] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [ignorePatterns, setIgnorePatterns] = useState<string[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiReviewResult | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<IssueCategory>>(new Set());
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackValue>>({});

  useEffect(() => {
    setFeedbackMap(loadFeedback());
  }, []);

  useEffect(() => {
    setLoadingRules(true);
    httpGet<AiTeamRules>('/api/gerrit/ai-rules')
      .then((data) => {
        const merged = { ...DEFAULT_TEAM_RULES, ...data };
        setSavedRules(merged);
        setCustomInstructionEnabled(Boolean(merged.customInstructions));
        setCustomInstructions(merged.customInstructions || '');
        setFocusAreas(merged.focusAreas || []);
        setIgnorePatterns(merged.ignorePatterns || []);
      })
      .catch(() => {
        setSavedRules({ ...DEFAULT_TEAM_RULES });
        setCustomInstructionEnabled(false);
        setCustomInstructions('');
        setFocusAreas([]);
        setIgnorePatterns([]);
      })
      .finally(() => setLoadingRules(false));
  }, [changeNumber, revisionId, baseRevisionId]);

  useEffect(() => {
    const cacheKey = buildReviewCacheKey(changeNumber, revisionId, baseRevisionId);
    const cached = loadReviewResultCache()[cacheKey];
    if (cached) {
      setResult(cached);
      setStep('result');
      setError(null);
      return;
    }
    setResult(null);
    setStep('config');
    setError(null);
  }, [changeNumber, revisionId, baseRevisionId]);

  const rulesOverride = useMemo<AiTeamRules>(() => ({
    enabled: savedRules.enabled,
    customInstructions: customInstructionEnabled ? customInstructions.trim() : '',
    focusAreas,
    ignorePatterns,
  }), [customInstructionEnabled, customInstructions, focusAreas, ignorePatterns, savedRules.enabled]);

  const runReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await httpPost<AiReviewResult>('/api/gerrit/ai-review', {
        changeNumber,
        revisionId,
        baseRevisionId,
        feedbackEntries: loadFeedbackHistory().slice(-40),
        rulesOverride,
      });
      setResult(response);
      saveReviewResultCache(buildReviewCacheKey(changeNumber, revisionId, baseRevisionId), response);
      setStep('result');

      const autoExpand = new Set<IssueCategory>();
      for (const issue of response.issues) {
        if (issue.severity === 'high') autoExpand.add(issue.category);
      }
      setExpandedCategories(autoExpand);
    } catch (err: any) {
      setError(err.message || 'AI Analysis Failed');
      setStep('config');
    } finally {
      setLoading(false);
    }
  }, [baseRevisionId, changeNumber, revisionId, rulesOverride]);

  const handleFeedback = useCallback((issue: AiIssue, value: FeedbackValue) => {
    setFeedbackMap((prev) => ({ ...prev, [issue.id]: value }));
    saveFeedback(issue.id, value);
    appendFeedbackHistory({
      issueId: issue.id,
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

  const visibleIssues = useMemo(() => result?.issues || [], [result?.issues]);
  const groupedIssues = useMemo(() => {
    const grouped = new Map<IssueCategory, AiIssue[]>();
    for (const issue of visibleIssues) {
      const existing = grouped.get(issue.category) || [];
      existing.push(issue);
      grouped.set(issue.category, existing);
    }
    return grouped;
  }, [visibleIssues]);

  const categoryOrder: IssueCategory[] = ['bug', 'performance', 'maintainability', 'style'];
  const sortedCategories: IssueCategory[] = categoryOrder.filter((category) => groupedIssues.has(category));
  const quickFocusOptions = ['兼容性', '异常处理', '回归风险', '性能', '边界条件'];

  const addToken = (value: string, setter: (next: string) => void, collectionSetter: Dispatch<SetStateAction<string[]>>) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    collectionSetter((prev) => Array.from(new Set([...prev, trimmed])));
    setter('');
  };

  const toggleFocusArea = (area: string) => {
    setFocusAreas((prev) => (
      prev.includes(area)
        ? prev.filter((entry) => entry !== area)
        : [...prev, area]
    ));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-none" id="ai-review-workspace">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI Review
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {step === 'config' ? '开始 AI 智能评审' : 'AI 已生成本次评审建议'}
          </div>
        </div>
        {step === 'config' && (
          <div className="hidden rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground sm:block">
            Smart defaults
          </div>
        )}
        {step === 'result' && result && (
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 pr-2.5',
              RISK_LEVEL_META[result.overview.riskLevel].bgColor,
              RISK_LEVEL_META[result.overview.riskLevel].textColor,
              RISK_LEVEL_META[result.overview.riskLevel].borderColor
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', RISK_LEVEL_META[result.overview.riskLevel].dotColor)} />
            {RISK_LEVEL_META[result.overview.riskLevel].label}
          </Badge>
        )}
      </div>

      <div className="max-h-[min(72vh,42rem)] overflow-y-auto bg-muted/[0.02] px-4 py-4">
        {loadingRules ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading AI rules...
          </div>
        ) : step === 'config' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <div className="mb-2 text-sm font-medium text-foreground">快速关注点</div>
              <div className="flex flex-wrap gap-2">
                {quickFocusOptions.map((option) => {
                  const active = focusAreas.includes(option);
                  return (
                    <button
                      key={option}
                      onClick={() => toggleFocusArea(option)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs transition-colors',
                        active
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground'
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {focusAreas.filter((item) => !quickFocusOptions.includes(item)).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {focusAreas
                    .filter((item) => !quickFocusOptions.includes(item))
                    .map((item) => (
                      <Badge key={item} variant="secondary" className="gap-1 pr-1">
                        {item}
                        <button onClick={() => setFocusAreas((prev) => prev.filter((entry) => entry !== item))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <Input
                  value={focusInput}
                  onChange={(e) => setFocusInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addToken(focusInput, setFocusInput, setFocusAreas);
                    }
                  }}
                  placeholder="添加自定义关注点"
                  className="h-9 shadow-none"
                />
                <Button variant="outline" className="h-9 px-3 shadow-none" onClick={() => addToken(focusInput, setFocusInput, setFocusAreas)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <button
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">高级配置</div>
                </div>
                {showAdvanced ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 border-t border-border/40 pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enable-inline-custom-instructions"
                        checked={customInstructionEnabled}
                        onCheckedChange={(checked) => setCustomInstructionEnabled(Boolean(checked))}
                      />
                      <Label htmlFor="enable-inline-custom-instructions" className="text-sm font-medium">
                        启用自定义指令
                      </Label>
                    </div>
                    {customInstructionEnabled && (
                      <Textarea
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="例如：优先检查兼容性、线程安全和异常处理。"
                        className="min-h-[96px] resize-y bg-background shadow-none"
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium">忽略的文件</div>
                    <div className="flex flex-wrap gap-2">
                      {ignorePatterns.length > 0 ? ignorePatterns.map((item) => (
                        <Badge key={item} variant="outline" className="gap-1 pr-1 font-mono">
                          {item}
                          <button onClick={() => setIgnorePatterns((prev) => prev.filter((entry) => entry !== item))}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )) : <span className="text-xs text-muted-foreground">未设置忽略规则</span>}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={ignoreInput}
                        onChange={(e) => setIgnoreInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addToken(ignoreInput, setIgnoreInput, setIgnorePatterns);
                          }
                        }}
                        placeholder="比如：*.md、dist/、vendor/"
                        className="h-9 font-mono shadow-none"
                      />
                      <Button variant="outline" className="h-9 px-3 shadow-none" onClick={() => addToken(ignoreInput, setIgnoreInput, setIgnorePatterns)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  分析失败
                </div>
                <p>{error}</p>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在读取 Diff 并生成结构化分析报告...
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {result.overview.changeTypes.map((type) => CHANGE_TYPE_META[type] || type).join('、')}
                </span>
                <Button variant="outline" size="sm" className="gap-2" onClick={runReview}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Re-run
                </Button>
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground/85">{result.overview.summary}</p>
              {result.overview.focusPoints.length > 0 && (
                <div className="mt-3 rounded-xl bg-muted/[0.03] px-3 py-2">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">关键关注点</div>
                  <ul className="space-y-1 text-sm text-foreground/80">
                    {result.overview.focusPoints.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {sortedCategories.length > 0 ? (
              <div className="space-y-3">
                {sortedCategories.map((category) => {
                  const issues = groupedIssues.get(category)!;
                  const meta = ISSUE_CATEGORY_META[category];
                  const isExpanded = expandedCategories.has(category);
                  return (
                    <div key={category} className="overflow-hidden rounded-2xl border border-border/50 bg-background">
                      <button
                        onClick={() => {
                          setExpandedCategories((prev) => {
                            const next = new Set(prev);
                            if (next.has(category)) next.delete(category);
                            else next.add(category);
                            return next;
                          });
                        }}
                        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/20"
                      >
                        <div className="flex items-center gap-2">
                          <span>{meta.icon}</span>
                          <span className={cn('text-sm font-medium', meta.color)}>{meta.label}</span>
                          <span className="text-xs text-muted-foreground">{issues.length}</span>
                        </div>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <div className="space-y-2 border-t border-border/40 p-4">
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
              <div className="rounded-2xl border border-border/50 bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                未发现主要问题
              </div>
            )}
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-[11px] text-muted-foreground">
          {step === 'result' && result
            ? `${visibleIssues.length} findings · ${result.usedModel || 'AI model'}`
            : '建议先直接运行一次，再按结果微调配置'}
        </span>
        <div className="flex items-center gap-2">
          {step === 'result' && (
            <Button variant="ghost" onClick={() => setStep('config')}>
              Refine
            </Button>
          )}
          <Button onClick={runReview} disabled={loading || loadingRules} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Analyzing...' : step === 'result' ? 'Run Again' : 'Start Review'}
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  const highlightedEvidence = useMemo(
    () => highlightSnippet(issue.evidence?.snippet || '', issue.title),
    [issue.evidence?.snippet, issue.title]
  );
  const severityMeta = RISK_LEVEL_META[issue.severity];
  const isDismissed = feedback === 'dismissed' || feedback === 'false-positive';

  return (
    <div className={cn(
      'rounded-2xl border px-3 py-3 text-xs transition-all',
      isDismissed ? 'border-border/40 bg-muted/20 opacity-55' : 'border-border/60 bg-card'
    )}>
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', severityMeta.dotColor)} />
        <div className="min-w-0 flex-1">
          <button onClick={() => setShowDetail((prev) => !prev)} className="flex w-full items-start justify-between gap-2 text-left">
            <span className="text-sm font-medium leading-5 text-foreground/90">{issue.title}</span>
            {issue.verification && (
              <Badge
                variant="outline"
                className={cn(
                  'h-5 px-1.5 text-[10px]',
                  issue.verification.status === 'confirmed' && 'border-green-200 bg-green-50 text-green-600',
                  issue.verification.status === 'uncertain' && 'border-amber-200 bg-amber-50 text-amber-600',
                  issue.verification.status === 'rejected' && 'border-red-200 bg-red-50 text-red-600'
                )}
              >
                {issue.verification.status === 'confirmed' ? '已确认' : issue.verification.status === 'uncertain' ? '存疑' : '已驳回'}
              </Badge>
            )}
          </button>

          {issue.file && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="max-w-[240px] truncate font-mono text-[11px] text-muted-foreground" title={issue.file}>
                {issue.file}
              </span>
              {issue.line && onJumpToLine && (
                <button
                  onClick={() => onJumpToLine(issue.file as string, issue.line as number)}
                  className="font-mono text-[11px] text-primary hover:underline"
                >
                  :L{issue.line}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showDetail && (
        <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
          <p className="text-sm leading-6 text-foreground/80">{issue.description}</p>
          {issue.suggestion && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <div className="mb-1 text-[11px] font-medium text-blue-700">建议修复</div>
              <p className="text-sm text-blue-900">{issue.suggestion}</p>
            </div>
          )}
          {issue.evidence?.snippet && (
            <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">相关代码</div>
              <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-foreground/80">{highlightedEvidence}</pre>
            </div>
          )}
          {issue.verification?.reason && (
            <p className="text-[11px] italic text-muted-foreground">复核说明: {issue.verification.reason}</p>
          )}
          <div className="flex items-center gap-1 pt-1">
            <FeedbackButton
              active={feedback === 'helpful'}
              onClick={() => onFeedback(issue, 'helpful')}
              icon={<ThumbsUp className="h-3 w-3" />}
              activeColor="bg-green-50 text-green-600"
              title="有用"
            />
            <FeedbackButton
              active={feedback === 'false-positive'}
              onClick={() => onFeedback(issue, 'false-positive')}
              icon={<ThumbsDown className="h-3 w-3" />}
              activeColor="bg-red-50 text-red-600"
              title="误报"
            />
            <FeedbackButton
              active={feedback === 'dismissed'}
              onClick={() => onFeedback(issue, 'dismissed')}
              icon={<X className="h-3 w-3" />}
              activeColor="bg-neutral-100 text-neutral-600"
              title="忽略"
            />
            {issue.file && issue.line && onAddDraftComment && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto gap-1"
                onClick={() => onAddDraftComment(issue.file as string, issue.line as number, `[AI 建议] ${issue.title}\n\n${issue.suggestion || issue.description}`)}
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

function FeedbackButton({
  active,
  onClick,
  icon,
  activeColor,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  activeColor: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-lg p-1.5 transition-colors',
        active ? activeColor : 'text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground'
      )}
    >
      {icon}
    </button>
  );
}
