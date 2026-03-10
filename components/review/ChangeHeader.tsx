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
  ExternalLink,
  GitBranch,
  GitMerge,
  Clock,
  User,
  Loader2,
  RefreshCw,
  Sparkles,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

interface ChangeHeaderProps {
  change: GerritChange;
  gerritUrl: string;
  canShowMerge: boolean;
  submittingMerge: boolean;
  submittingReview: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSubmitMerge: () => void;
  onOpenReviewDialog: () => void;
  onOpenAiWorkspace: () => void;
  selectedPatchsetNumber?: number;
  fileCount?: number;
  totalInsertions?: number;
  totalDeletions?: number;
}

export function ChangeHeader({
  change,
  gerritUrl,
  canShowMerge,
  submittingMerge,
  submittingReview,
  onBack,
  onRefresh,
  onSubmitMerge,
  onOpenReviewDialog,
  onOpenAiWorkspace,
  selectedPatchsetNumber,
  fileCount,
  totalInsertions,
  totalDeletions,
}: ChangeHeaderProps) {
  return (
    <div className="group/change-header">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-9 gap-2 pl-0 -ml-2 text-muted-foreground hover:text-foreground" 
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-wrap items-center gap-2 self-start">
          <HeaderActionButton icon={MessageSquare} label="Review" onClick={onOpenReviewDialog} />
          <HeaderActionButton icon={Sparkles} label="AI Review" onClick={onOpenAiWorkspace} />

          {canShowMerge && (
            <Button
              variant="default"
              size="sm"
              className="h-9 gap-1.5 rounded-xl px-3.5"
              onClick={onSubmitMerge}
              disabled={submittingMerge || submittingReview || change.status !== 'NEW'}
            >
              {submittingMerge ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitMerge className="h-3.5 w-3.5" />
              )}
              {submittingMerge ? 'Merging...' : 'Merge'}
            </Button>
          )}
          
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground" onClick={onRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <a
            href={`${gerritUrl}/c/${change._number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 pointer-events-none translate-x-1 transition-all duration-200 group-hover/change-header:opacity-100 group-hover/change-header:pointer-events-auto group-hover/change-header:translate-x-0"
          >
            <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-border/60 bg-background/85 shadow-none">
              <ExternalLink className="h-3.5 w-3.5" />
              Gerrit
            </Button>
          </a>
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
            <Badge variant="outline" className="mt-1 shrink-0 rounded-full border-border/60 bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              #{change._number}
            </Badge>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {selectedPatchsetNumber !== undefined && (
              <SummaryPill label="Patchset" value={`PS${selectedPatchsetNumber}`} />
            )}
            {fileCount !== undefined && (
              <SummaryPill label="Files" value={String(fileCount)} />
            )}
            {totalInsertions !== undefined && (
              <SummaryPill label="Added" value={`+${totalInsertions}`} tone="green" />
            )}
            {totalDeletions !== undefined && (
              <SummaryPill label="Removed" value={`-${totalDeletions}`} tone="red" />
            )}
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
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-border/60 bg-background/85 px-3.5 shadow-none" onClick={onClick}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function SummaryPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'green' | 'red';
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs',
        tone === 'neutral' && 'border-border/60 bg-background text-foreground/80',
        tone === 'green' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        tone === 'red' && 'border-rose-200 bg-rose-50 text-rose-700'
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
