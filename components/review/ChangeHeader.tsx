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
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  GitMerge,
  Clock,
  User,
  Loader2,
  RefreshCw,
  MessageSquare,
  FileText
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
    <div className="space-y-4">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 text-muted-foreground hover:text-foreground pl-0 -ml-2" 
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="flex items-center gap-2">
          {canShowMerge && (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
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
          
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <a
            href={`${gerritUrl}/c/${change._number}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <ExternalLink className="h-3.5 w-3.5" />
              Gerrit
            </Button>
          </a>
        </div>
      </div>

      {/* Main Title Area */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
            {change.subject}
          </h1>
          <Badge variant="outline" className="font-mono text-muted-foreground shrink-0 mt-1">
            #{change._number}
          </Badge>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-muted-foreground">
          <Badge variant="secondary" className={cn('rounded-md px-2 py-0.5 font-medium', getStatusColor(change.status))}>
            {getStatusLabel(change.status)}
          </Badge>
          
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground/70" />
            <a
              href={`${gerritUrl}/admin/repos/${encodeURIComponent(change.project)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors font-medium text-foreground"
            >
              {abbreviateProject(change.project)}
            </a>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-mono text-xs">{change.branch}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground/70" />
            <a
              href={`${gerritUrl}/q/owner:${encodeURIComponent(change.owner.email || change.owner.username || getAccountName(change.owner))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {getAccountName(change.owner)}
            </a>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span>{relativeTime(change.updated)}</span>
          </div>
        </div>
      </div>

      {/* Labels & Commit Message Section */}
      <div className="flex flex-col gap-4 pt-2">
        {change.labels && Object.keys(change.labels).length > 0 && (
          <div className="flex items-center gap-3">
             <LabelsSummary labels={change.labels} />
          </div>
        )}

        {commitMessage && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Commit Message
            </div>
            <pre className="text-sm text-foreground/90 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed max-h-60 overflow-y-auto">
              {commitMessage}
            </pre>
          </div>
        )}
      </div>
      
      <Separator className="mt-2" />
    </div>
  );
}
