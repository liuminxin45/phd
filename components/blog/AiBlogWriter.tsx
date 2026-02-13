import { useState, useRef, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { httpGet, httpPost } from '@/lib/httpClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PostsResponse } from '@/lib/blog/types';
import { buildAnalysisPrompt, buildOutlinePrompt, buildWritePrompt } from '@/lib/blog/prompts';

// ─── Types ───────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface Step {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  result?: string;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const INITIAL_STEPS: Omit<Step, 'status'>[] = [
  { id: 'fetch', label: '获取热门博客', description: '获取"最多赞"前 30 篇技术博客数据' },
  { id: 'analyze', label: '分析博客共性', description: 'AI 分析热门博客的成功因素与技术写作特征' },
  { id: 'outline', label: '拟定博客大纲', description: '根据分析结果，AI 自主拟定博客主题与详细大纲' },
  { id: 'write', label: '撰写博客正文', description: '按大纲使用 Remarkup 格式撰写完整博客' },
];

function makeSteps(): Step[] {
  return INITIAL_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus }));
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running': return <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />;
    case 'done':    return <Check className="h-4 w-4 text-green-600 shrink-0" />;
    case 'error':   return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case 'pending': return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
  }
}

// ─── LLM helper ──────────────────────────────────────────────────────────────

async function callLLM(
  messages: { role: string; content: string }[],
  temperature?: number,
  maxTokens?: number,
): Promise<string> {
  const res = await httpPost<{ content?: string; error?: string }>('/api/ai/chat', {
    messages,
    temperature,
    maxTokens,
  });
  if (res.error) throw new Error(res.error);
  return res.content || '';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AiBlogWriter({
  onFill,
}: {
  onFill: (title: string, content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<Step[]>(makeSteps);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const abortRef = useRef(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const updateStep = useCallback((id: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const reset = useCallback(() => {
    setSteps(makeSteps());
    setRunning(false);
    setDone(false);
    setGeneratedTitle('');
    setGeneratedContent('');
    setExpandedStep(null);
    abortRef.current = false;
  }, []);

  // ── Pipeline ───────────────────────────────────────────────────────────────

  const runPipeline = useCallback(async () => {
    reset();
    setRunning(true);

    try {
      // ── Step 1: Fetch top 30 posts ─────────────────────────────────────
      updateStep('fetch', { status: 'running' });

      const postsRes = await httpGet<PostsResponse>('/api/blogs/posts', {
        type: 'tech',
        sort: 'tokenCount',
        limit: 30,
      });
      const posts = postsRes.data || [];
      if (posts.length === 0) throw new Error('未找到任何技术博客，请确认博客数据可用');

      const postSummaries = posts
        .map(
          (p, i) =>
            `${i + 1}. 《${p.title}》（赞数: ${p.tokenCount}, 作者: ${p.authorName}, 阅读时长: ${p.readTime}）\n   摘要: ${p.summary}`,
        )
        .join('\n\n');

      const topBodies = posts
        .slice(0, 5)
        .map((p, i) => `── 文章 ${i + 1}: 《${p.title}》 ──\n${p.body.slice(0, 3000)}`)
        .join('\n\n');

      updateStep('fetch', {
        status: 'done',
        result: `成功获取 ${posts.length} 篇热门技术博客（赞数 ${posts[0]?.tokenCount ?? 0} ~ ${posts[posts.length - 1]?.tokenCount ?? 0}）`,
      });
      if (abortRef.current) return;

      // ── Step 2: Analyze commonalities (LLM #1) ────────────────────────
      updateStep('analyze', { status: 'running' });

      const analysis = await callLLM(
        [
          {
            role: 'system',
            content:
              '你是一位资深技术内容分析专家，善于从大量文章中提炼规律和洞察。请用中文回答。',
          },
          { role: 'user', content: buildAnalysisPrompt(postSummaries, topBodies, posts.length) },
        ],
        0.4,
        4096,
      );

      updateStep('analyze', { status: 'done', result: analysis });
      if (abortRef.current) return;

      // ── Step 3: Draft outline (LLM #2) ────────────────────────────────
      updateStep('outline', { status: 'running' });

      const outline = await callLLM(
        [
          {
            role: 'system',
            content:
              '你是一位技术博客内容策划专家，善于设计引人入胜的技术文章结构。请用中文回答。',
          },
          { role: 'user', content: buildOutlinePrompt(analysis) },
        ],
        0.6,
        4096,
      );

      const titleMatch = outline.match(/标题[:：]\s*(.+)/);
      const blogTitle = titleMatch?.[1]?.replace(/["""]/g, '').trim() || 'AI 生成的技术博客';

      updateStep('outline', { status: 'done', result: outline });
      if (abortRef.current) return;

      // ── Step 4: Write full blog (LLM #3) ──────────────────────────────
      updateStep('write', { status: 'running' });

      const blogContent = await callLLM(
        [
          {
            role: 'system',
            content:
              '你是一位经验丰富的技术博客作者，善于将复杂技术概念用清晰、有条理的方式表达出来。你熟练使用 Phabricator Remarkup 格式写作。请直接输出博客正文，不要加任何前言或说明。',
          },
          { role: 'user', content: buildWritePrompt(outline) },
        ],
        0.7,
        8192,
      );

      updateStep('write', { status: 'done', result: '博客撰写完成' });

      setGeneratedTitle(blogTitle);
      setGeneratedContent(blogContent);
      setDone(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      setSteps((prev) =>
        prev.map((s) =>
          s.status === 'running'
            ? { ...s, status: 'error' as StepStatus, error: message }
            : s,
        ),
      );
    } finally {
      setRunning(false);
    }
  }, [reset, updateStep]);

  const handleFill = () => {
    onFill(generatedTitle, generatedContent);
    setOpen(false);
  };

  const handleOpen = () => {
    reset();
    setOpen(true);
  };

  const progressPercent = (steps.filter((s) => s.status === 'done').length / steps.length) * 100;
  const hasError = steps.some((s) => s.status === 'error');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
        onClick={handleOpen}
        title="AI 智能写博客"
      >
        <Sparkles className="h-3.5 w-3.5" />
        AI 写博客
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!running) setOpen(v); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              AI 智能博客生成
            </DialogTitle>
            <DialogDescription>
              基于热门博客分析，自动生成高质量技术博客
            </DialogDescription>
          </DialogHeader>

          {/* Progress bar */}
          <Progress value={progressPercent} className="h-1.5" />

          {/* Steps list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={cn(
                  'border rounded-lg p-3 transition-colors',
                  step.status === 'running' && 'border-amber-300 bg-amber-50/50',
                  step.status === 'done' && 'border-green-200 bg-green-50/30',
                  step.status === 'error' && 'border-red-200 bg-red-50/30',
                  step.status === 'pending' && 'border-border bg-muted/20 opacity-60',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <StepStatusIcon status={step.status} />
                    <div>
                      <span className="text-sm font-medium">{step.label}</span>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {idx + 1}/{steps.length}
                    </Badge>
                    {step.result && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                          setExpandedStep(expandedStep === step.id ? null : step.id)
                        }
                      >
                        {expandedStep === step.id ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Error message */}
                {step.error && (
                  <div className="mt-2 text-xs text-red-600 bg-red-100/50 p-2 rounded">
                    {step.error}
                  </div>
                )}

                {/* Expanded result */}
                {expandedStep === step.id && step.result && (
                  <div className="mt-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                    {step.result}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Completion banner */}
          {done && (
            <div className="border-t pt-4 space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  AI 博客已生成完成
                </p>
                <p className="text-xs text-green-600 mt-1">
                  标题：{generatedTitle}
                </p>
                <p className="text-xs text-green-600">
                  正文：约 {generatedContent.length} 字
                </p>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <DialogFooter>
            {!running && !done && !hasError && (
              <Button onClick={runPipeline} className="gap-1.5">
                <Sparkles className="h-4 w-4" />
                开始生成
              </Button>
            )}
            {running && (
              <Button disabled variant="outline" className="gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </Button>
            )}
            {done && (
              <Button
                onClick={handleFill}
                className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              >
                <Copy className="h-4 w-4" />
                一键填充到编辑器
              </Button>
            )}
            {!running && hasError && (
              <Button onClick={runPipeline} variant="outline" className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                重新生成
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
