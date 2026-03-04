import { AlertTriangle, CheckCircle2, Clock, History, Loader2, SkipForward, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-primary" />
            随机点赞
          </DialogTitle>
          <DialogDescription>
            开启后会按间隔自动从最新技术博客中挑选一篇点赞数至少为 1 的文章进行点赞，已点赞文章会自动跳过。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={autoLikeEnabled} onCheckedChange={onAutoLikeEnabledChange} />
              <span className="text-sm text-foreground">开启自动随机点赞</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">间隔（分钟）</span>
              <Input
                type="number"
                min={MIN_AUTO_LIKE_INTERVAL_MINUTES}
                max={MAX_AUTO_LIKE_INTERVAL_MINUTES}
                value={autoLikeIntervalMinutes}
                onChange={(e) => onAutoLikeIntervalChange(e.target.value)}
                className="h-8 w-24"
              />
              <span className="text-xs text-muted-foreground">范围 1-720</span>
            </div>
            <Button onClick={onRunNow} size="sm" variant="outline" disabled={autoLikeRunning}>
              {autoLikeRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
              <span className="ml-1">立即执行一次</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-md border p-2 text-xs">
              <p className="text-muted-foreground">总记录</p>
              <p className="text-sm font-semibold text-foreground">{autoLikeStats.total}</p>
            </div>
            <div className="rounded-md border p-2 text-xs">
              <p className="text-muted-foreground">成功点赞</p>
              <p className="text-sm font-semibold text-foreground">{autoLikeStats.success}</p>
            </div>
            <div className="rounded-md border p-2 text-xs">
              <p className="text-muted-foreground">已点赞跳过</p>
              <p className="text-sm font-semibold text-foreground">{autoLikeStats.skipped}</p>
            </div>
            <div className="rounded-md border p-2 text-xs">
              <p className="text-muted-foreground">异常</p>
              <p className="text-sm font-semibold text-foreground">{autoLikeStats.errors}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="px-2" onClick={onToggleRecords}>
              <History className="h-4 w-4 mr-1.5" />
              {showAutoLikeRecords ? '收起记录' : '查看记录'}
            </Button>
            {autoLikeRecords.length > 0 && (
              <Button size="sm" variant="outline" onClick={onClearRecords}>
                清空记录
              </Button>
            )}
          </div>

          {showAutoLikeRecords && (
            <div className="space-y-2 max-h-64 overflow-auto border rounded-md p-2">
              {autoLikeRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无记录</p>
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

function AutoLikeRecordItem({ record }: { record: AutoLikeRecord }) {
  const icon =
    record.result === 'success' ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
    ) : record.result === 'skipped-liked' ? (
      <SkipForward className="h-3.5 w-3.5 text-amber-600" />
    ) : record.result === 'error' ? (
      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
    ) : (
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    );

  return (
    <div className="text-xs rounded border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="font-medium text-foreground">
            {record.result === 'success'
              ? '点赞成功'
              : record.result === 'skipped-liked'
                ? '跳过已点赞'
                : record.result === 'error'
                  ? '执行失败'
                  : '无候选文章'}
          </span>
        </div>
        <span className="text-muted-foreground">{new Date(record.time).toLocaleString()}</span>
      </div>
      {record.postTitle && (
        <p className="mt-1 text-foreground/90">
          #{record.postId} {record.postTitle}
          {typeof record.tokenCount === 'number' ? `（当前赞数: ${record.tokenCount}）` : ''}
        </p>
      )}
      {record.message && <p className="mt-1 text-muted-foreground">{record.message}</p>}
      {record.traceId && <p className="mt-1 text-muted-foreground">traceId: {record.traceId}</p>}
    </div>
  );
}
