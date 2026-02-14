import { cn } from '@/lib/utils';
import {
  relativeTime,
  getAccountName,
  abbreviateProject,
  getStatusColor,
  getStatusLabel,
} from '@/lib/gerrit/helpers';
import type { GerritChange } from '@/lib/gerrit/types';
import { LabelsSummary } from './LabelBadge';
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
} from 'lucide-react';

interface ChangeHeaderProps {
  change: GerritChange;
  gerritUrl: string;
  commitMessage?: string;
  canShowMerge: boolean;
  submittingMerge: boolean;
  submittingReview: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSubmitMerge: () => void;
}

export function ChangeHeader({
  change,
  gerritUrl,
  commitMessage,
  canShowMerge,
  submittingMerge,
  submittingReview,
  onBack,
  onRefresh,
  onSubmitMerge,
}: ChangeHeaderProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground leading-tight">
              {change.subject}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <Badge variant="secondary" className={cn('text-[10px]', getStatusColor(change.status))}>
                {getStatusLabel(change.status)}
              </Badge>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                <a
                  href={`${gerritUrl}/admin/repos/${encodeURIComponent(change.project)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary underline-offset-2 hover:underline"
                >
                  {abbreviateProject(change.project)}
                </a>
                {' → '}
                {change.branch}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <a
                  href={`${gerritUrl}/q/owner:${encodeURIComponent(change.owner.email || change.owner.username || getAccountName(change.owner))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary underline-offset-2 hover:underline"
                >
                  {getAccountName(change.owner)}
                </a>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime(change.updated)}
              </span>
              <span className="font-mono">#{change._number}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canShowMerge && (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={onSubmitMerge}
              disabled={submittingMerge || submittingReview || change.status !== 'NEW'}
            >
              {submittingMerge ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitMerge className="h-3.5 w-3.5" />
              )}
              {submittingMerge ? '合入中...' : 'Merge'}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} title="刷新">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <a
            href={`${gerritUrl}/c/${change._number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              Gerrit
            </Button>
          </a>
        </div>
      </div>

      {/* Labels */}
      {change.labels && (
        <div className="mt-3 pt-3 border-t border-border">
          <LabelsSummary labels={change.labels} />
        </div>
      )}

      {commitMessage && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">提交说明</p>
          <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap break-words rounded border bg-muted/30 px-2 py-2 max-h-44 overflow-y-auto">
            {commitMessage}
          </pre>
        </div>
      )}
    </>
  );
}
