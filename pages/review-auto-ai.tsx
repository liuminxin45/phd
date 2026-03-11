import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { httpGet } from '@/lib/httpClient';
import type { DashboardResponse, GerritChange } from '@/lib/gerrit/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  GitPullRequest,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AUTO_AI_STATE_EVENT,
  DEFAULT_AUTO_AI_MAX_LINES,
  hydrateAutoAiStateFromDisk,
  loadAutoAiEnabled,
  loadAutoAiJobs,
  loadAutoAiMaxLines,
  loadAutoAiRiskMap,
  removeAutoAiJob,
  setAutoAiEnabled,
  setAutoAiMaxLines,
  upsertAutoAiJobs,
  type AutoAiJob,
} from '@/lib/review/auto-ai';
import type { AiRiskSummary } from '@/lib/gerrit/ai-types';

function statusMeta(status: AutoAiJob['status']) {
  if (status === 'pending') return { label: 'Pending', icon: Clock, cls: 'border-amber-200 bg-amber-50 text-amber-700', iconCls: 'text-amber-600' };
  if (status === 'running') return { label: 'Running', icon: Activity, cls: 'border-blue-200 bg-blue-50 text-blue-700', iconCls: 'text-blue-600 animate-spin' };
  if (status === 'done') return { label: 'Done', icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', iconCls: 'text-emerald-600' };
  if (status === 'skipped') return { label: 'Skipped', icon: AlertTriangle, cls: 'border-slate-200 bg-slate-50 text-slate-700', iconCls: 'text-slate-500' };
  return { label: 'Error', icon: XCircle, cls: 'border-red-200 bg-red-50 text-red-700', iconCls: 'text-red-600' };
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getJobDuration(job: AutoAiJob): string {
  if (!job.startedAt) return '-';
  const start = Date.parse(job.startedAt);
  const end = Date.parse(job.finishedAt || new Date().toISOString());
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '-';
  return formatDurationMs(Math.max(0, end - start));
}

function getSourceLabel(source?: AutoAiJob['source']) {
  return source === 'manual' ? 'Manual' : 'Auto';
}

function dedupeChanges(dashboard: DashboardResponse | null): GerritChange[] {
  if (!dashboard) return [];
  const map = new Map<number, GerritChange>();
  for (const section of dashboard.sections || []) {
    for (const change of section.changes || []) {
      if (change.status !== 'NEW' || !change.current_revision) continue;
      map.set(change._number, change);
    }
  }
  return Array.from(map.values()).sort((a, b) => Date.parse(b.updated || '') - Date.parse(a.updated || ''));
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'blue' | 'emerald' | 'slate' | 'red';
}) {
  const tones = {
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    slate: 'text-slate-700 bg-slate-50 border-slate-200',
    red: 'text-red-700 bg-red-50 border-red-200',
  };
  return (
    <div className={cn('rounded-2xl border p-4', tones[tone])}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function riskMeta(riskLevel?: AiRiskSummary['riskLevel']) {
  if (riskLevel === 'high') return { label: 'High', cls: 'border-red-200 bg-red-50 text-red-700' };
  if (riskLevel === 'medium') return { label: 'Medium', cls: 'border-amber-200 bg-amber-50 text-amber-700' };
  if (riskLevel === 'low') return { label: 'Low', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  return null;
}

type DisplayJob = AutoAiJob & {
  displaySubject: string;
  displayOwnerName: string;
  displayChangedLines: number | null;
  riskSummary?: AiRiskSummary;
};

function JobCard({
  job,
  onOpenChange,
  onRemove,
}: {
  job: DisplayJob;
  onOpenChange: (changeNumber: number) => void;
  onRemove: (key: string) => void;
}) {
  const meta = statusMeta(job.status);
  const Icon = meta.icon;
  const removable = job.status === 'pending';
  const risk = job.status === 'done' ? riskMeta(job.riskSummary?.riskLevel) : null;

  return (
    <div className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm transition-colors hover:bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <button
            className="flex items-center gap-2 text-left text-sm font-semibold text-primary transition hover:opacity-80"
            onClick={() => onOpenChange(job.changeNumber)}
          >
            <GitPullRequest className="h-4 w-4" />
            <span>Change #{job.changeNumber}</span>
          </button>
          <div className="line-clamp-2 text-sm text-foreground">{job.displaySubject}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{job.displayOwnerName}</span>
            <span>{job.displayChangedLines ?? '-'} lines</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('gap-1.5 rounded-full px-2.5 py-1 text-[11px]', meta.cls)}>
            <Icon className={cn('h-3 w-3', meta.iconCls)} />
            {meta.label}
          </Badge>
          {risk && (
            <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px]', risk.cls)}>
              {risk.label}
            </Badge>
          )}
          {removable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-red-600"
              onClick={() => onRemove(job.key)}
              title="Remove pending task"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
          {getSourceLabel(job.source)}
        </Badge>
        <span>Duration {getJobDuration(job)}</span>
        <span>{new Date(job.updatedAt).toLocaleString()}</span>
      </div>

      {job.error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {job.error}
        </div>
      )}
    </div>
  );
}

function JobColumn({
  title,
  items,
  onOpenChange,
  onRemove,
}: {
  title: string;
  items: DisplayJob[];
  onOpenChange: (changeNumber: number) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/95 shadow-none">
      <CardHeader className="border-b border-border/50 bg-muted/20 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <Badge variant="secondary" className="rounded-full px-2.5 py-1 font-mono text-[11px]">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
            No tasks in this lane.
          </div>
        ) : (
          items.map((job) => (
            <JobCard key={job.key} job={job} onOpenChange={onOpenChange} onRemove={onRemove} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function ReviewAutoAiPage() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [maxLines, setMaxLinesState] = useState(DEFAULT_AUTO_AI_MAX_LINES);
  const [jobs, setJobs] = useState<Record<string, AutoAiJob>>({});
  const [riskMap, setRiskMap] = useState<Record<number, AiRiskSummary>>({});
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadingChanges, setLoadingChanges] = useState(false);

  const syncFromStorage = useCallback(() => {
    setEnabled(loadAutoAiEnabled());
    setMaxLinesState(loadAutoAiMaxLines());
    setJobs(loadAutoAiJobs());
    setRiskMap(loadAutoAiRiskMap());
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoadingChanges(true);
    try {
      const res = await httpGet<DashboardResponse>('/api/gerrit/dashboard');
      setDashboard(res);
    } finally {
      setLoadingChanges(false);
    }
  }, []);

  useEffect(() => {
    syncFromStorage();
    void hydrateAutoAiStateFromDisk(true).finally(() => {
      syncFromStorage();
    });
    void loadDashboard();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('review-auto-ai-')) {
        syncFromStorage();
      }
    };
    const onCustomChange = () => {
      syncFromStorage();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(AUTO_AI_STATE_EVENT, onCustomChange as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(AUTO_AI_STATE_EVENT, onCustomChange as EventListener);
    };
  }, [loadDashboard, syncFromStorage]);

  const handleOpenChange = useCallback((changeNumber: number) => {
    router.push({ pathname: '/review', query: { change: String(changeNumber) } });
  }, [router]);

  const handleToggleEnabled = useCallback((checked: boolean) => {
    setAutoAiEnabled(checked);
    setEnabled(checked);
  }, []);

  const handleUpdateMaxLines = useCallback((raw: string) => {
    const parsed = Number(raw);
    const safe = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_AUTO_AI_MAX_LINES;
    setAutoAiMaxLines(safe);
    setMaxLinesState(safe);
  }, []);

  const allReadableChanges = useMemo(() => dedupeChanges(dashboard), [dashboard]);
  const readableChangeMap = useMemo(() => {
    const map = new Map<number, GerritChange>();
    for (const change of allReadableChanges) {
      map.set(change._number, change);
    }
    return map;
  }, [allReadableChanges]);
  const queuedKeys = useMemo(() => new Set(Object.keys(jobs)), [jobs]);
  const queuedChangeNumbers = useMemo(() => new Set(Object.values(jobs).map((job) => job.changeNumber)), [jobs]);
  const queuedJobMap = useMemo(() => {
    const map = new Map<string, AutoAiJob>();
    for (const job of Object.values(jobs)) {
      map.set(job.key, job);
    }
    return map;
  }, [jobs]);

  const grouped = useMemo(() => {
    const all = Object.values(jobs)
      .map((job): DisplayJob => {
        const matchedChange = readableChangeMap.get(job.changeNumber);
        return {
          ...job,
          displaySubject: matchedChange?.subject || job.subject || 'No subject',
          displayOwnerName: matchedChange?.owner?.name || matchedChange?.owner?.username || job.ownerName || 'Unknown owner',
          displayChangedLines: matchedChange
            ? Math.max(0, (matchedChange.insertions || 0) + (matchedChange.deletions || 0))
            : (typeof job.totalChangedLines === 'number' ? job.totalChangedLines : null),
          riskSummary: riskMap[job.changeNumber],
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      pending: all.filter((job) => job.status === 'pending'),
      running: all.filter((job) => job.status === 'running'),
      done: all.filter((job) => job.status === 'done'),
      skipped: all.filter((job) => job.status === 'skipped'),
      error: all.filter((job) => job.status === 'error'),
    };
  }, [jobs, readableChangeMap, riskMap]);

  const handleQueueOne = useCallback((change: GerritChange) => {
    upsertAutoAiJobs([change], {
      source: 'manual',
      maxLines,
      ignoreMaxLines: true,
      preserveFinished: false,
    });
    setJobs(loadAutoAiJobs());
  }, [maxLines]);

  const handleRemovePending = useCallback((key: string) => {
    const target = jobs[key];
    if (!target || target.status !== 'pending') return;
    setJobs(removeAutoAiJob(key));
  }, [jobs]);

  return (
    <div className="min-h-full overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.10),_transparent_24%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--background))_100%)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <Card className="overflow-hidden border-border/60 bg-card/95 shadow-none">
          <CardContent className="p-0">
            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_0.9fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => router.push('/review')} className="h-10 w-10 rounded-full">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => void loadDashboard()} className="h-10 w-10 rounded-full">
                    {loadingChanges ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI Review Monitor</h1>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Pending" value={grouped.pending.length} tone="amber" />
                  <MetricCard label="Running" value={grouped.running.length} tone="blue" />
                  <MetricCard label="Done" value={grouped.done.length} tone="emerald" />
                  <MetricCard label="Errors" value={grouped.error.length} tone="red" />
                </div>
              </div>

              <div className="rounded-[28px] border border-border/60 bg-muted/20 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Automatic monitor</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-sm font-medium', enabled ? 'text-foreground' : 'text-muted-foreground')}>
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-end gap-3">
                  <label className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Max changed lines</div>
                    <Input
                      type="number"
                      min={1}
                      value={maxLines}
                      onChange={(event) => handleUpdateMaxLines(event.target.value)}
                      className="h-10 w-32 rounded-xl bg-background font-mono"
                    />
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
          <Card className="overflow-hidden border-border/60 bg-card/95 shadow-none">
            <CardHeader className="border-b border-border/50 bg-muted/20">
              <CardTitle className="text-base">Readable changes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {loadingChanges && allReadableChanges.length === 0 ? (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/70 px-4 py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading readable changes...
                </div>
              ) : allReadableChanges.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
                  No readable open changes found.
                </div>
              ) : (
                allReadableChanges.map((change) => {
                  const currentJob = queuedJobMap.get(`${change._number}:${String(change.current_revision)}`);
                  const queued = currentJob?.status === 'pending' || currentJob?.status === 'running';
                  return (
                    <div key={`${change._number}:${change.current_revision}`} className="rounded-2xl border border-border/60 bg-background/95 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-3">
                          <button
                            className="flex items-center gap-2 text-left text-sm font-semibold text-primary transition hover:opacity-80"
                            onClick={() => handleOpenChange(change._number)}
                          >
                            <GitPullRequest className="h-4 w-4" />
                            <span>Change #{change._number}</span>
                          </button>
                          <div className="line-clamp-2 text-sm text-foreground">{change.subject}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>{change.owner?.name || change.owner?.username || 'Unknown owner'}</span>
                            <span>{Math.max(0, (change.insertions || 0) + (change.deletions || 0))} lines</span>
                          </div>
                        </div>
                        <Button
                          variant={queued ? 'outline' : 'default'}
                          disabled={queued}
                          onClick={() => handleQueueOne(change)}
                          size="icon"
                          className="h-9 w-9 rounded-full shrink-0"
                          title={queued ? 'Queued' : currentJob ? 'Queue again' : 'Add to queue'}
                        >
                          {queued ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <JobColumn title="Pending" items={grouped.pending} onOpenChange={handleOpenChange} onRemove={handleRemovePending} />
            <JobColumn title="Running" items={grouped.running} onOpenChange={handleOpenChange} onRemove={handleRemovePending} />
            <JobColumn title="Done" items={grouped.done} onOpenChange={handleOpenChange} onRemove={handleRemovePending} />
            <JobColumn title="Skipped / Error" items={[...grouped.skipped, ...grouped.error]} onOpenChange={handleOpenChange} onRemove={handleRemovePending} />
          </div>
        </div>
      </div>
    </div>
  );
}
