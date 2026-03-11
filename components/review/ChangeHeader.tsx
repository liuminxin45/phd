import { cn } from '@/lib/utils';
import {
  relativeTime,
  getAccountName,
  abbreviateProject,
  getStatusColor,
  getStatusLabel,
} from '@/lib/gerrit/helpers';
import type { GerritChange } from '@/lib/gerrit/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  GitBranch,
  GitMerge,
  Clock,
  User,
  Loader2,
  RefreshCw,
  MessageSquare,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChangeHeaderProps {
  change: GerritChange;
  gerritUrl: string;
  canShowMerge: boolean;
  mergeReady?: boolean;
  mergeHint?: string;
  submittingMerge: boolean;
  submittingReview: boolean;
  aiReviewRunning?: boolean;
  onBack: () => void;
  onRefresh: () => void | Promise<boolean | void>;
  onSubmitMerge: () => void;
  onOpenReviewDialog: () => void;
  onOpenAiReviewDialog: () => void;
}

export function ChangeHeader({
  change,
  gerritUrl,
  canShowMerge,
  mergeReady = false,
  mergeHint,
  submittingMerge,
  submittingReview,
  aiReviewRunning = false,
  onBack,
  onRefresh,
  onSubmitMerge,
  onOpenReviewDialog,
  onOpenAiReviewDialog,
}: ChangeHeaderProps) {
  const gerritChangeUrl = `${gerritUrl}/c/${change._number}`;

  const handleCopyGerritLink = async () => {
    try {
      await navigator.clipboard.writeText(gerritChangeUrl);
      toast.success('Gerrit 链接已复制');
    } catch {
      toast.error('复制失败，请手动复制链接');
    }
  };

  const handleOpenGerrit = () => {
    const newWindow = window.open(gerritChangeUrl, '_blank', 'noopener,noreferrer');
    if (newWindow) {
      toast.success('已在新窗口打开 Gerrit');
    } else {
      toast.error('打开失败，请检查浏览器弹窗设置');
    }
  };

  const handleOpenReview = () => {
    onOpenReviewDialog();
  };

  const handleOpenAiReview = () => {
    onOpenAiReviewDialog();
  };

  const handleRefresh = async () => {
    try {
      const result = await onRefresh();
      if (result !== false) {
        toast.success('提交详情已刷新');
      }
    } catch {
      toast.error('刷新失败，请稍后重试');
    }
  };

  return (
    <div className="group/change-header">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button 
          variant="ghost" 
          size="icon"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" 
          onClick={onBack}
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex flex-wrap items-center gap-2 self-start">
          <HeaderActionButton
            icon={Sparkles}
            label={aiReviewRunning ? 'AI Review Running' : 'Start Review'}
            onClick={handleOpenAiReview}
            disabled={aiReviewRunning}
            animate={aiReviewRunning}
          />
          
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/60 bg-background/85 shadow-none backdrop-blur supports-[backdrop-filter]:bg-background/70" onClick={handleRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl border-border/60 bg-background/85 shadow-none backdrop-blur supports-[backdrop-filter]:bg-background/70"
            onClick={handleCopyGerritLink}
            title="Copy Gerrit URL"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl border-border/60 bg-background/85 shadow-none backdrop-blur supports-[backdrop-filter]:bg-background/70"
            title="Open in Gerrit"
            onClick={handleOpenGerrit}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="default"
            size="icon"
            className="h-9 w-9 rounded-xl shadow-none backdrop-blur supports-[backdrop-filter]:bg-primary/88"
            onClick={handleOpenReview}
            title="Review"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>

          {canShowMerge && (
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-xl shadow-none border",
                mergeReady
                  ? "border-emerald-300 bg-emerald-500 text-white hover:bg-emerald-600"
                  : "border-red-300 bg-red-500 text-white hover:bg-red-600"
              )}
              onClick={onSubmitMerge}
              disabled={submittingMerge || submittingReview || change.status !== 'NEW'}
              title={submittingMerge ? 'Merging...' : (mergeHint || 'Merge')}
            >
              {submittingMerge ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitMerge className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
            <Badge variant="secondary" className={cn('h-7 rounded-full border border-transparent px-2.5 text-[12px] font-medium', getStatusColor(change.status))}>
              {getStatusLabel(change.status)}
            </Badge>

            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground/70" />
              <a
                href={`${gerritUrl}/admin/repos/${encodeURIComponent(change.project)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground transition-colors hover:text-primary"
              >
                {abbreviateProject(change.project)}
              </a>
              <span className="text-muted-foreground/35">/</span>
              <span className="font-mono text-[12px]">{change.branch}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground/70" />
              <a
                href={`${gerritUrl}/q/owner:${encodeURIComponent(change.owner.email || change.owner.username || getAccountName(change.owner))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {getAccountName(change.owner)}
              </a>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span>{relativeTime(change.updated)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="min-w-0 flex-1 text-[34px] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground text-balance">
              {change.subject}
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  animate = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  animate?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        'h-9 w-9 rounded-xl border-border/60 bg-background/85 shadow-none backdrop-blur supports-[backdrop-filter]:bg-background/70',
        animate && 'animate-pulse',
        disabled && 'cursor-not-allowed opacity-70'
      )}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <Icon className={cn('h-3.5 w-3.5', animate && 'opacity-80')} />
    </Button>
  );
}
