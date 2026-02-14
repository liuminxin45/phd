import { useState, useRef, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  Check,
  Copy,
  AlertCircle,
  RotateCcw,
  ClipboardList,
} from 'lucide-react';
import { httpPost } from '@/lib/httpClient';
import { useUser } from '@/contexts/UserContext';
import { getLastWeekRange } from '@/lib/blog/helpers';
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
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface Step {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const INITIAL_STEPS: Omit<Step, 'status'>[] = [
  { id: 'generate', label: '请求 AI 生成周报', description: '调用 BoostAgent 服务，基于 Phabricator 数据自动生成周报' },
  { id: 'download', label: '下载周报内容', description: '获取生成的 Markdown 周报正文' },
  { id: 'fill', label: '填充到编辑器', description: '将标题和正文自动填入编辑器' },
];

function makeSteps(): Step[] {
  return INITIAL_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus }));
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />;
    case 'done':    return <Check className="h-4 w-4 text-green-600 shrink-0" />;
    case 'error':   return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case 'pending': return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AiReportWriter({
  onFill,
}: {
  onFill: (title: string, content: string) => void;
}) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<Step[]>(makeSteps);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const abortRef = useRef(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const updateStep = useCallback((id: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const reset = useCallback(() => {
    setSteps(makeSteps());
    setRunning(false);
    setDone(false);
    setGeneratedContent('');
    abortRef.current = false;
  }, []);

  // ── Pipeline ───────────────────────────────────────────────────────────────

  const runPipeline = useCallback(async () => {
    reset();
    setRunning(true);

    try {
      const username = user?.userName;
      if (!username) throw new Error('无法获取当前用户名，请确认已登录');

      // ── Step 1 & 2: Generate + Download (handled by our API route) ────
      updateStep('generate', { status: 'running' });

      const dateStr = new Date().toISOString().slice(0, 10);

      const res = await httpPost<{ content?: string; error?: string }>(
        '/api/blogs/ai-report',
        { username, date: dateStr },
      );

      if (res.error) throw new Error(res.error);
      if (!res.content) throw new Error('AI 服务未返回周报内容');

      updateStep('generate', { status: 'done' });
      if (abortRef.current) return;

      updateStep('download', { status: 'running' });
      // Content is already downloaded by the API route
      updateStep('download', { status: 'done' });
      if (abortRef.current) return;

      // ── Step 3: Fill ──────────────────────────────────────────────────
      updateStep('fill', { status: 'running' });
      setGeneratedContent(res.content);
      updateStep('fill', { status: 'done' });

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
  }, [reset, updateStep, user]);

  const handleFill = () => {
    const title = getLastWeekRange();
    onFill(title, generatedContent);
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
        className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        onClick={handleOpen}
        title="AI 自动生成周报"
      >
        <Sparkles className="h-3.5 w-3.5" />
        AI 周报
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!running) setOpen(v); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-500" />
              AI 智能周报生成
            </DialogTitle>
            <DialogDescription>
              基于 Phabricator 任务数据，自动生成本周工作周报
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
                  step.status === 'running' && 'border-blue-300 bg-blue-50/50',
                  step.status === 'done' && 'border-green-200 bg-green-50/30',
                  step.status === 'error' && 'border-red-200 bg-red-50/30',
                  step.status === 'pending' && 'border-border bg-muted/20 opacity-60',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <StepStatusIcon status={step.status} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{step.label}</span>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {idx + 1}/{steps.length}
                  </span>
                </div>

                {/* Error message */}
                {step.error && (
                  <div className="mt-2 text-xs text-red-600 bg-red-100/50 p-2 rounded">
                    {step.error}
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
                  AI 周报已生成完成
                </p>
                <p className="text-xs text-green-600 mt-1">
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
