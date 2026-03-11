import { AlertTriangle, CheckCircle2, Clock, History, Loader2, SkipForward, ThumbsUp, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { glassInputClass, glassPanelStrongClass, glassSectionClass, glassToolbarClass } from '@/components/ui/glass';
import {
  AutoLikeRecord,
  MAX_AUTO_LIKE_INTERVAL_MINUTES,
  MIN_AUTO_LIKE_INTERVAL_MINUTES,
} from '@/lib/blog/autoLike';

interface AutoLikeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoLikeEnabled: boolean;
  onAutoLikeEnabledChange: (enabled: boolean) => void;
  autoLikeIntervalMinutes: number;
  onAutoLikeIntervalChange: (value: string) => void;
  autoLikeRunning: boolean;
  onRunNow: () => Promise<void>;
  autoLikeStats: {
    total: number;
    success: number;
    skipped: number;
    errors: number;
  };
  autoLikeRecords: AutoLikeRecord[];
  showAutoLikeRecords: boolean;
  onToggleRecords: () => void;
  onClearRecords: () => void;
}

export function AutoLikeDialog(props: AutoLikeDialogProps) {
  const {
    open,
    onOpenChange,
    autoLikeEnabled,
    onAutoLikeEnabledChange,
    autoLikeIntervalMinutes,
    onAutoLikeIntervalChange,
    autoLikeRunning,
    onRunNow,
    autoLikeStats,
    autoLikeRecords,
    showAutoLikeRecords,
    onToggleRecords,
    onClearRecords,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(glassPanelStrongClass, "sm:max-w-2xl rounded-3xl border border-white/70 bg-[#f8fbff]/92 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78")}>
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <ThumbsUp className="h-4 w-4 text-sky-700" />
            Random Like
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className={cn(glassToolbarClass, "flex flex-wrap items-center gap-3 rounded-2xl border border-white/60 p-3")}>
            <div className="flex items-center gap-2 rounded-xl border border-white/55 bg-white/72 px-3 py-2">
              <Switch checked={autoLikeEnabled} onCheckedChange={onAutoLikeEnabledChange} />
              <span className="text-sm font-medium text-slate-700">Enable Auto Like</span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/55 bg-white/72 px-2.5 py-1.5">
              <span className="text-xs text-slate-500">Interval</span>
              <Input
                type="number"
                min={MIN_AUTO_LIKE_INTERVAL_MINUTES}
                max={MAX_AUTO_LIKE_INTERVAL_MINUTES}
                value={autoLikeIntervalMinutes}
                onChange={(e) => onAutoLikeIntervalChange(e.target.value)}
                className={cn(glassInputClass, "h-8 w-20 rounded-lg border-white/55 bg-white/78 px-2 text-center text-sm shadow-none")}
              />
              <span className="text-xs text-slate-500">min</span>
            </div>

            <Button onClick={onRunNow} size="sm" variant="outline" disabled={autoLikeRunning} className="h-9 gap-1.5 rounded-xl border border-sky-200/80 bg-white/75 text-sky-700 hover:border-sky-300/80 hover:bg-sky-50/70 hover:text-sky-800">
              {autoLikeRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
              Run Now
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Total" value={autoLikeStats.total} />
            <Stat label="Success" value={autoLikeStats.success} />
            <Stat label="Skipped" value={autoLikeStats.skipped} />
            <Stat label="Errors" value={autoLikeStats.errors} />
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="h-8 rounded-xl border border-white/55 bg-white/70 px-2.5 text-xs text-slate-700 hover:bg-white/85" onClick={onToggleRecords}>
              <History className="mr-1.5 h-3.5 w-3.5" />
              {showAutoLikeRecords ? 'Hide Records' : 'View Records'}
            </Button>
            {autoLikeRecords.length > 0 && (
              <Button size="sm" variant="outline" onClick={onClearRecords} className="h-8 rounded-xl border border-amber-200/80 bg-white/72 text-amber-700 hover:border-amber-300 hover:bg-amber-50">
                Clear Records
              </Button>
            )}
          </div>

          {showAutoLikeRecords && (
            <div className={cn(glassSectionClass, "max-h-64 space-y-2 overflow-auto rounded-2xl border border-white/62 p-2.5")}>
              {autoLikeRecords.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-500">No records yet</p>
              ) : autoLikeRecords.map((record) => (
                <AutoLikeRecordItem key={record.id} record={record} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/58 bg-white/72 p-2.5 text-xs shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
      <p className="text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function AutoLikeRecordItem({ record }: { record: AutoLikeRecord }) {
  const icon =
    record.result === 'success' ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
    ) : record.result === 'skipped-liked' ? (
      <SkipForward className="h-3.5 w-3.5 text-amber-600" />
    ) : record.result === 'error' ? (
      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
    ) : (
      <Clock className="h-3.5 w-3.5 text-slate-500" />
    );

  const resultLabel =
    record.result === 'success'
      ? 'Liked'
      : record.result === 'skipped-liked'
        ? 'Skipped (already liked)'
        : record.result === 'error'
          ? 'Failed'
          : 'No candidate';

  return (
    <div className="rounded-xl border border-white/58 bg-white/76 p-2.5 text-xs shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="font-medium text-slate-800">{resultLabel}</span>
        </div>
        <span className="text-slate-500">{new Date(record.time).toLocaleString()}</span>
      </div>
      {record.postTitle && (
        <p className="mt-1 text-slate-700">
          #{record.postId} {record.postTitle}
          {typeof record.tokenCount === 'number' ? ` (likes: ${record.tokenCount})` : ''}
        </p>
      )}
      {record.message && <p className="mt-1 text-slate-500">{record.message}</p>}
      {record.traceId && <p className="mt-1 text-slate-500">traceId: {record.traceId}</p>}
    </div>
  );
}
