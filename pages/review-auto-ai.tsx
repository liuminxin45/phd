import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import {
  AUTO_AI_ENABLED_KEY,
  AUTO_AI_JOBS_KEY,
  AUTO_AI_MAX_LINES_KEY,
  DEFAULT_AUTO_AI_MAX_LINES,
  loadAutoAiEnabled,
  loadAutoAiJobs,
  loadAutoAiMaxLines,
  type AutoAiJob,
} from '@/lib/review/auto-ai';

function statusMeta(status: AutoAiJob['status']) {
  if (status === 'pending') return { label: '排队中', cls: 'text-amber-700 border-amber-200' };
  if (status === 'running') return { label: '处理中', cls: 'text-blue-700 border-blue-200' };
  if (status === 'done') return { label: '已完成', cls: 'text-green-700 border-green-200' };
  if (status === 'skipped') return { label: '已跳过', cls: 'text-neutral-600 border-neutral-300' };
  return { label: '失败', cls: 'text-red-700 border-red-200' };
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getJobDuration(job: AutoAiJob): string {
  if (!job.startedAt) return '-';
  const start = Date.parse(job.startedAt);
  const end = Date.parse(job.finishedAt || new Date().toISOString());
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '-';
  return formatDurationMs(Math.max(0, end - start));
}

function JobList({ title, items, onOpenChange }: { title: string; items: AutoAiJob[]; onOpenChange: (changeNumber: number) => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-3 py-2 border-b text-sm font-medium flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="secondary" className="text-[10px] font-mono">{items.length}</Badge>
        </div>
        {items.length === 0 ? (
          <div className="px-3 py-5 text-xs text-muted-foreground">暂无</div>
        ) : (
          <div className="divide-y max-h-[44vh] overflow-y-auto">
            {items.map((job) => {
              const meta = statusMeta(job.status);
              return (
                <div key={job.key} className="px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      className="font-mono text-blue-600 hover:underline"
                      onClick={() => onOpenChange(job.changeNumber)}
                    >
                      #{job.changeNumber}
                    </button>
                    <Badge variant="outline" className={`text-[10px] ml-auto ${meta.cls}`}>{meta.label}</Badge>
                  </div>
                  <div className="text-[11px] text-foreground truncate">
                    {job.subject || '-'}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span>{job.ownerName || '-'}</span>
                    <span>改动：{job.totalChangedLines ?? '-'} 行</span>
                    <span>耗时：{getJobDuration(job)}</span>
                    <span>{new Date(job.updatedAt).toLocaleString()}</span>
                  </div>
                  {job.error && <div className="text-[11px] text-red-600 break-all">{job.error}</div>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReviewAutoAiPage() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [maxLines, setMaxLines] = useState(DEFAULT_AUTO_AI_MAX_LINES);
  const [jobs, setJobs] = useState<Record<string, AutoAiJob>>({});

  const handleOpenChange = useCallback((changeNumber: number) => {
    router.push({ pathname: '/review', query: { change: String(changeNumber) } });
  }, [router]);

  const reload = () => {
    setEnabled((prev) => {
      const next = loadAutoAiEnabled();
      return prev === next ? prev : next;
    });
    setMaxLines((prev) => {
      const next = loadAutoAiMaxLines();
      return prev === next ? prev : next;
    });
    setJobs((prev) => {
      const next = loadAutoAiJobs();
      const prevRaw = JSON.stringify(prev);
      const nextRaw = JSON.stringify(next);
      return prevRaw === nextRaw ? prev : next;
    });
  };

  const updateMaxLines = (raw: string) => {
    const parsed = Number(raw);
    const safe = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_AUTO_AI_MAX_LINES;
    setMaxLines(safe);
    try {
      localStorage.setItem(AUTO_AI_MAX_LINES_KEY, String(safe));
    } catch {}
  };

  useEffect(() => {
    reload();
    const timer = setInterval(reload, 1500);
    return () => clearInterval(timer);
  }, []);

  const grouped = useMemo(() => {
    const all = Object.values(jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      pending: all.filter((j) => j.status === 'pending'),
      running: all.filter((j) => j.status === 'running'),
      done: all.filter((j) => j.status === 'done'),
      skipped: all.filter((j) => j.status === 'skipped'),
      error: all.filter((j) => j.status === 'error'),
    };
  }, [jobs]);

  const clearFinished = () => {
    const next: Record<string, AutoAiJob> = {};
    for (const [k, v] of Object.entries(jobs)) {
      if (v.status === 'pending' || v.status === 'running') next[k] = v;
    }
    setJobs(next);
    try {
      localStorage.setItem(AUTO_AI_JOBS_KEY, JSON.stringify(next));
    } catch {}
  };

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(AUTO_AI_ENABLED_KEY, next ? '1' : '0');
    } catch {}
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">AI 自动监控工作台</h1>
              <p className="text-xs text-muted-foreground mt-1">查看排队中、处理中、已完成、已跳过与失败任务</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                自动处理改动行数上限
                <input
                  type="number"
                  min={1}
                  value={maxLines}
                  onChange={(e) => updateMaxLines(e.target.value)}
                  className="h-8 w-28 rounded border border-border bg-background px-2 text-xs text-foreground"
                  title="超过该行数的变更将自动跳过，不执行 AI Review"
                />
              </label>
              <Button variant={enabled ? 'default' : 'outline'} size="sm" onClick={toggleEnabled}>
                自动监控 {enabled ? '开' : '关'}
              </Button>
              <Button variant="outline" size="sm" onClick={reload} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                刷新
              </Button>
              <Button variant="outline" size="sm" onClick={clearFinished}>清理已完成/失败</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <JobList title="排队中" items={grouped.pending} onOpenChange={handleOpenChange} />
          <JobList title="处理中" items={grouped.running} onOpenChange={handleOpenChange} />
          <JobList title="已完成" items={grouped.done} onOpenChange={handleOpenChange} />
          <JobList title="已跳过" items={grouped.skipped} onOpenChange={handleOpenChange} />
          <JobList title="失败" items={grouped.error} onOpenChange={handleOpenChange} />
        </div>
      </div>
    </div>
  );
}
