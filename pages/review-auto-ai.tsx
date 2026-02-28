import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ArrowLeft, Trash2, Clock, Activity, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { Input } from '@/components/ui/input';

function statusMeta(status: AutoAiJob['status']) {
  if (status === 'pending') return { label: '等待中', icon: Clock, cls: 'text-amber-700 bg-amber-50 border-amber-200', iconCls: 'text-amber-600' };
  if (status === 'running') return { label: '进行中', icon: Activity, cls: 'text-blue-700 bg-blue-50 border-blue-200', iconCls: 'text-blue-600 animate-spin' };
  if (status === 'done') return { label: '已完成', icon: CheckCircle2, cls: 'text-green-700 bg-green-50 border-green-200', iconCls: 'text-green-600' };
  if (status === 'skipped') return { label: '已跳过', icon: AlertTriangle, cls: 'text-neutral-600 bg-neutral-50 border-neutral-200', iconCls: 'text-neutral-500' };
  return { label: '错误', icon: XCircle, cls: 'text-red-700 bg-red-50 border-red-200', iconCls: 'text-red-600' };
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}小时 ${m}分 ${s}秒`;
  if (m > 0) return `${m}分 ${s}秒`;
  return `${s}秒`;
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
    <Card className="h-full flex flex-col overflow-hidden border-t-4 border-t-primary/20">
      <CardHeader className="px-4 py-3 bg-muted/20 border-b border-border/40 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Badge variant="secondary" className="font-mono text-xs">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <span className="text-xs">No tasks</span>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {items.map((job) => {
              const meta = statusMeta(job.status);
              const StatusIcon = meta.icon;
              return (
                <div key={job.key} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <button
                      className="font-mono text-xs font-medium text-primary hover:underline flex items-center gap-1.5"
                      onClick={() => onOpenChange(job.changeNumber)}
                    >
                      #{job.changeNumber}
                      <span className="text-muted-foreground/50 font-normal">({job.revisionId})</span>
                    </button>
                    <Badge variant="outline" className={cn("text-[9px] h-5 gap-1 pl-1", meta.cls)}>
                      <StatusIcon className={cn("h-3 w-3", meta.iconCls)} />
                      {meta.label}
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-foreground/90 truncate mb-2" title={job.subject}>
                    {job.subject || <span className="text-muted-foreground italic">No subject</span>}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-foreground/80">{job.ownerName || 'Unknown'}</span>
                    </span>
                    <span className="w-px h-2.5 bg-border/60" />
                    <span>{job.totalChangedLines ?? '-'} lines</span>
                    <span className="w-px h-2.5 bg-border/60" />
                    <span>Duration: {getJobDuration(job)}</span>
                    <span className="ml-auto text-[9px] opacity-70">
                      {new Date(job.updatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {job.error && (
                    <div className="mt-2 p-2 rounded bg-red-50 text-[10px] text-red-600 font-mono break-all border border-red-100">
                      {job.error}
                    </div>
                  )}
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
    <div className="h-full overflow-auto bg-background/50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/review')} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI 自动监控</h1>
              <p className="text-sm text-muted-foreground">监控并管理自动评审任务</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Card className="flex items-center gap-3 px-3 py-1.5 border-dashed bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">最大行数限制</span>
              <Input
                type="number"
                min={1}
                value={maxLines}
                onChange={(e) => updateMaxLines(e.target.value)}
                className="h-7 w-20 text-xs bg-background text-right font-mono"
                title="超过此行数的变更将被跳过"
              />
            </Card>

            <Button 
              variant={enabled ? 'default' : 'secondary'} 
              size="sm" 
              onClick={toggleEnabled}
              className={cn("gap-2", !enabled && "text-muted-foreground")}
            >
              <Activity className={cn("h-4 w-4", enabled && "animate-pulse")} />
              {enabled ? '监控运行中' : '监控已暂停'}
            </Button>
            
            <Button variant="outline" size="sm" onClick={reload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            
            <Button variant="outline" size="sm" onClick={clearFinished} className="gap-2 text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
              清除已完成
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card border rounded-lg p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">等待中</span>
            <span className="text-2xl font-bold text-amber-600">{grouped.pending.length}</span>
          </div>
          <div className="bg-card border rounded-lg p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">进行中</span>
            <span className="text-2xl font-bold text-blue-600">{grouped.running.length}</span>
          </div>
          <div className="bg-card border rounded-lg p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">已完成</span>
            <span className="text-2xl font-bold text-green-600">{grouped.done.length}</span>
          </div>
          <div className="bg-card border rounded-lg p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">已跳过</span>
            <span className="text-2xl font-bold text-muted-foreground">{grouped.skipped.length}</span>
          </div>
          <div className="bg-card border rounded-lg p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase">失败</span>
            <span className="text-2xl font-bold text-red-600">{grouped.error.length}</span>
          </div>
        </div>

        {/* Lists */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Column 1: Active */}
          <div className="space-y-6">
            <JobList title="等待中" items={grouped.pending} onOpenChange={handleOpenChange} />
            <JobList title="进行中" items={grouped.running} onOpenChange={handleOpenChange} />
          </div>
          
          {/* Column 2: Completed */}
          <div className="space-y-6">
            <JobList title="已完成" items={grouped.done} onOpenChange={handleOpenChange} />
          </div>

          {/* Column 3: Others */}
          <div className="space-y-6">
            <JobList title="已跳过" items={grouped.skipped} onOpenChange={handleOpenChange} />
            <JobList title="失败" items={grouped.error} onOpenChange={handleOpenChange} />
          </div>
        </div>
      </div>
    </div>
  );
}
