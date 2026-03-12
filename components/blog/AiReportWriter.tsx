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
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { GlassIconButton, glassPanelStrongClass } from '@/components/ui/glass';
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
  { id: 'generate', label: 'Generate draft', description: 'Run the weekly report generation pipeline' },
  { id: 'download', label: 'Load content', description: 'Retrieve generated Markdown report' },
  { id: 'polish', label: 'Merge & polish', description: 'Blend your notes, formalize, and expand' },
  { id: 'fill', label: 'Ready to fill', description: 'Insert title and report into editor' },
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
  iconOnly = false,
}: {
  onFill: (title: string, content: string) => void;
  iconOnly?: boolean;
}) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<Step[]>(makeSteps);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [polishWarning, setPolishWarning] = useState('');
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
    setPolishWarning('');
    abortRef.current = false;
  }, []);

  // ── Pipeline ───────────────────────────────────────────────────────────────

  const runPipeline = useCallback(async () => {
    reset();
    setRunning(true);

    try {
      const username = user?.userName;
      if (!username) throw new Error('Unable to detect current username. Please sign in again.');

      // ── Step 1 & 2: Generate + Download (handled by our API route) ────
      updateStep('generate', { status: 'running' });

      const dateStr = new Date().toISOString().slice(0, 10);

      const res = await httpPost<{ content?: string; error?: string; polished?: boolean; polishWarning?: string }>(
        '/api/blogs/ai-report',
        { username, date: dateStr, manualNotes },
      );

      if (res.error) throw new Error(res.error);
      if (!res.content) throw new Error('AI pipeline returned empty report content');

      updateStep('generate', { status: 'done' });
      if (abortRef.current) return;

      updateStep('download', { status: 'running' });
      // Content is already downloaded by the API route
      updateStep('download', { status: 'done' });
      if (abortRef.current) return;

      // ── Step 3: Polish (optional) ─────────────────────────────────────
      updateStep('polish', { status: 'running' });
      if (manualNotes.trim()) {
        if (res.polishWarning) {
          setPolishWarning(res.polishWarning);
        }
      }
      updateStep('polish', { status: 'done' });
      if (abortRef.current) return;

      // ── Step 4: Fill ──────────────────────────────────────────────────
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
  }, [manualNotes, reset, updateStep, user]);

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
      {iconOnly ? (
        <GlassIconButton
          onClick={handleOpen}
          tone="primary"
          tooltip="AI Weekly Report"
          aria-label="AI Weekly Report"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </GlassIconButton>
      ) : (
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
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!running) setOpen(v); }}>
        <DialogContent className={cn(glassPanelStrongClass, "sm:max-w-xl max-h-[86vh] flex flex-col rounded-3xl border border-white/70 bg-[#f8fbff]/92 shadow-[0_28px_66px_rgba(15,23,42,0.2)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78")}>
          <DialogHeader className="border-b border-white/55 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-500" />
              AI Weekly Report
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-2xl border border-white/60 bg-white/65 p-3 backdrop-blur-xl">
            <label className="mb-2 block text-xs font-medium text-slate-700">
              Optional notes (what you did last week and what you plan next)
            </label>
            <Textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Example: Last week I finished camera SDK export flow, fixed import error logs, and supported device-level compatibility checks. Next week I will complete integration tests and resolve remaining review comments."
              className="min-h-[92px] resize-y rounded-xl border-white/60 bg-white/78 text-sm shadow-none focus-visible:ring-0 focus-visible:outline-none"
            />
          </div>

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
                  step.status === 'pending' && 'border-border bg-muted/20 opacity-70',
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
                  Weekly report generated
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Content length: ~{generatedContent.length} chars
                </p>
              </div>
            </div>
          )}

          {polishWarning && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-700">
              LLM polish fallback to base report: {polishWarning}
            </div>
          )}

          {/* Footer actions */}
          <DialogFooter>
            {!running && !done && !hasError && (
              <Button onClick={runPipeline} className="gap-1.5">
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            )}
            {running && (
              <Button disabled variant="outline" className="gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </Button>
            )}
            {done && (
              <Button
                onClick={handleFill}
                className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              >
                <Copy className="h-4 w-4" />
                Fill into editor
              </Button>
            )}
            {!running && hasError && (
              <Button onClick={runPipeline} variant="outline" className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
