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
import { MessageSquare, GitBranch, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ChangeCardProps {
  change: GerritChange;
  onClick: () => void;
  gerritUrl?: string;
  showOwner?: boolean;
}

export function ChangeCard({ change, onClick, gerritUrl, showOwner = true }: ChangeCardProps) {
  const hasUnresolved = (change.unresolved_comment_count || 0) > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex flex-col gap-2 p-3 rounded-lg border bg-card cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-primary/30 hover:-translate-y-px',
        hasUnresolved && 'border-l-2 border-l-amber-400'
      )}
    >
      {/* Row 1: Subject + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {change.subject}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 truncate">
              <GitBranch className="h-3 w-3 shrink-0" />
              <span className="truncate">{abbreviateProject(change.project)}</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="truncate">{change.branch}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="secondary" className={cn('text-[10px] font-medium', getStatusColor(change.status))}>
            {getStatusLabel(change.status)}
          </Badge>
          {gerritUrl && (
            <a
              href={`${gerritUrl}/c/${change._number}`}
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="在 Gerrit 中打开"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Row 2: Labels + stats */}
      <div className="flex items-center justify-between gap-2">
        <LabelsSummary labels={change.labels} compact />

        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          {/* Diff stats */}
          <span className="flex items-center gap-1.5">
            <span className="text-green-600 font-medium">+{change.insertions || 0}</span>
            <span className="text-red-500 font-medium">-{change.deletions || 0}</span>
          </span>

          {/* Comments */}
          {(change.total_comment_count || 0) > 0 && (
            <span className={cn('flex items-center gap-0.5', hasUnresolved && 'text-amber-600 font-medium')}>
              <MessageSquare className="h-3 w-3" />
              {change.unresolved_comment_count || 0}/{change.total_comment_count}
            </span>
          )}
        </div>
      </div>

      {/* Row 3: Owner + time */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {showOwner && (
          <span className="truncate">
            {getAccountName(change.owner)}
          </span>
        )}
        <span className="shrink-0 ml-auto">{relativeTime(change.updated)}</span>
      </div>
    </div>
  );
}
