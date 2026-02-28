import { cn } from '@/lib/utils';
import {
  relativeTime,
  getAccountName,
  abbreviateProject,
  getStatusColor,
  getStatusLabel,
} from '@/lib/gerrit/helpers';
import type { GerritChange } from '@/lib/gerrit/types';
import type { RiskLevel } from '@/lib/gerrit/ai-types';
import { LabelsSummary } from './LabelBadge';
import { AiRiskDot } from './AiRiskDot';
import { MessageSquare, GitBranch, ExternalLink, User, Calendar, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ChangeCardProps {
  change: GerritChange;
  onClick: () => void;
  gerritUrl?: string;
  showOwner?: boolean;
  unread?: boolean;
  aiRiskLevel?: RiskLevel;
  aiRiskReason?: string;
}

export function ChangeCard({ change, onClick, gerritUrl, showOwner = true, unread = false, aiRiskLevel, aiRiskReason }: ChangeCardProps) {
  const hasUnresolved = (change.unresolved_comment_count || 0) > 0;

  return (
    <Card 
      onClick={onClick}
      className={cn(
        "group cursor-pointer hover:shadow-md transition-all duration-200 border-l-4",
        hasUnresolved ? "border-l-amber-400" : "border-l-transparent"
      )}
    >
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {/* Top Row: Title & Primary Meta */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {unread && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" aria-label="unread" />}
              <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-none truncate" title={change.subject}>
                {change.subject}
              </h3>
              
              {/* Meta: Owner & Date (Inline) */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground ml-2 shrink-0">
                {showOwner && (
                  <div className="flex items-center gap-1" title="Owner">
                    <User className="h-3 w-3 opacity-70" />
                    <a
                      href={`${gerritUrl}/q/owner:${encodeURIComponent(change.owner.email || change.owner.username || getAccountName(change.owner))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-foreground transition-colors max-w-[120px] truncate"
                    >
                      {getAccountName(change.owner)}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-1" title={`Updated: ${new Date(change.updated).toLocaleString()}`}>
                  <Calendar className="h-3 w-3 opacity-70" />
                  <span>{relativeTime(change.updated)}</span>
                </div>
              </div>
            </div>

            {/* External Link */}
            {gerritUrl && (
              <a
                href={`${gerritUrl}/c/${change._number}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
                title="Open in Gerrit"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Bottom Row: Status, Repo, Stats, Labels */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-1 min-w-0 overflow-hidden">
              <Badge variant="secondary" className={cn('px-1.5 py-0 text-[10px] font-medium rounded-sm shrink-0', getStatusColor(change.status))}>
                {getStatusLabel(change.status)}
              </Badge>

              <span className="flex items-center gap-1 truncate text-muted-foreground/80" title={change.project}>
                <GitBranch className="h-3 w-3 shrink-0" />
                <a
                  href={`${gerritUrl}/admin/repos/${encodeURIComponent(change.project)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="truncate hover:text-primary transition-colors"
                >
                  {abbreviateProject(change.project)}
                </a>
                <span className="opacity-50">/</span>
                <span className="truncate">{change.branch}</span>
              </span>

              <div className="hidden xs:block h-3 w-px bg-border/60 shrink-0" />

              <span className="hidden xs:flex items-center gap-1 font-mono text-[10px] shrink-0">
                <span className="text-emerald-600">+{change.insertions || 0}</span>
                <span className="text-rose-500">-{change.deletions || 0}</span>
              </span>

              <AiRiskDot riskLevel={aiRiskLevel} briefReason={aiRiskReason} />

              {(change.total_comment_count || 0) > 0 && (
                <>
                  <div className="h-3 w-px bg-border/60 shrink-0" />
                  <span className={cn('flex items-center gap-1 shrink-0', hasUnresolved ? 'text-amber-600 font-medium' : '')}>
                    <MessageSquare className="h-3 w-3" />
                    {change.unresolved_comment_count || 0}/{change.total_comment_count}
                  </span>
                </>
              )}
            </div>

            <div className="shrink-0">
              <LabelsSummary labels={change.labels} compact />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
