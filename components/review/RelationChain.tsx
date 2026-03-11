import { useState } from 'react';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { getLabelScoreColor, getLabelScoreText, getStatusColor, getStatusLabel } from '@/lib/gerrit/helpers';
import type { GerritRelatedChange } from '@/lib/gerrit/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2, GitCommit, Layers, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function normalizeCommitSha(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const candidate = (value as any).commit ?? (value as any).id ?? (value as any).sha;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function getRelatedChangeSubject(rc: GerritRelatedChange): string {
  if (rc.subject) return rc.subject;
  if (rc.commit && typeof rc.commit === 'object') {
    if ('subject' in rc.commit) return (rc.commit as any).subject;
    if ('message' in rc.commit) {
      const msg = (rc.commit as any).message || '';
      return msg.split('\n')[0].substring(0, 80);
    }
  }
  return `#${rc._change_number}`;
}

function getRelatedCodeReviewScore(rc: GerritRelatedChange): number | null {
  const label = rc.labels?.['Code-Review'] || rc.labels?.['Label-Code-Review'];
  if (!label?.all?.length) return null;

  const numericVotes = label.all
    .map((vote) => vote?.value)
    .filter((value): value is number => typeof value === 'number');

  if (numericVotes.length === 0) return null;
  return Math.max(...numericVotes);
}

interface RelationChainProps {
  relatedChanges: GerritRelatedChange[];
  currentChangeNumber: number;
  gerritUrl: string;
  selectedRelatedKeys: Set<string>;
  canVotePlusOne: boolean;
  canVotePlusTwo: boolean;
  batchVoting: 0 | 1 | 2;
  batchMerging: boolean;
  onToggleKey: (key: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchVote: (score: 1 | 2) => void;
  onBatchMerge: () => void;
}

export function RelationChain({
  relatedChanges,
  currentChangeNumber,
  gerritUrl,
  selectedRelatedKeys,
  canVotePlusOne,
  canVotePlusTwo,
  batchVoting,
  batchMerging,
  onToggleKey,
  onSelectAll,
  onDeselectAll,
  onBatchVote,
  onBatchMerge,
}: RelationChainProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);

  if (relatedChanges.length === 0) return null;

  const relatedSelectableTotal = relatedChanges.length;
  const relatedSelectedTotal = relatedChanges.filter((c) => selectedRelatedKeys.has(`${c._change_number}:${c._revision_number}`)).length;
  const relatedAllChecked = relatedSelectableTotal > 0 && relatedSelectedTotal === relatedSelectableTotal;
  const relatedSomeChecked = relatedSelectedTotal > 0 && relatedSelectedTotal < relatedSelectableTotal;

  const navigateToChange = (changeNumber: number) => {
    if (changeNumber === currentChangeNumber) return;
    router.push({ pathname: '/review', query: { change: String(changeNumber) } }, undefined, { shallow: true }).catch(() => {});
  };

  return (
    <Card className="mt-4 border-l-4 border-l-purple-500/20">
      <CardHeader className="px-4 py-3 bg-muted/20 border-b border-border/40">
        <div
          className="flex cursor-pointer items-center justify-between gap-3"
          onClick={() => setCollapsed((prev) => !prev)}
          role="button"
          tabIndex={0}
          aria-expanded={!collapsed}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setCollapsed((prev) => !prev);
            }
          }}
        >
          <div className="flex min-w-0 items-center gap-2 text-left">
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <Layers className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm font-medium">Relation Chain</CardTitle>
            <Badge variant="secondary" className="h-5 bg-purple-50 text-[10px] text-purple-700">
              {relatedSelectedTotal}/{relatedChanges.length}
            </Badge>
          </div>
          
          {!collapsed && (
            <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            {canVotePlusOne && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1"
                disabled={batchVoting !== 0 || batchMerging}
                onClick={() => onBatchVote(1)}
              >
                {batchVoting === 1 ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>Batch +1</span>}
              </Button>
            )}
            {canVotePlusTwo && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1"
                disabled={batchVoting !== 0 || batchMerging}
                onClick={() => onBatchVote(2)}
              >
                {batchVoting === 2 ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>Batch +2</span>}
              </Button>
            )}
            {canVotePlusTwo && (
              <Button
                size="sm"
                className="h-7 px-2 text-[10px] gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={batchVoting !== 0 || batchMerging}
                onClick={onBatchMerge}
              >
                {batchMerging ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>Batch Merge</span>}
              </Button>
            )}
            </div>
          )}
        </div>
      </CardHeader>
      
      {!collapsed && (
      <CardContent className="p-0">
        {/* Select all toggle */}
        <div className="px-4 py-2 border-b border-border/40 flex items-center bg-muted/10">
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-border text-purple-600 focus:ring-purple-500"
              checked={relatedAllChecked}
              ref={(el) => {
                if (el) el.indeterminate = relatedSomeChecked;
              }}
              onChange={(e) => {
                if (e.target.checked) onSelectAll();
                else onDeselectAll();
              }}
            />
            Select All
          </label>
        </div>

        <div className="divide-y divide-border/40">
          {relatedChanges.map((rc) => {
            const isCurrent = rc._change_number === currentChangeNumber;
            const key = `${rc._change_number}:${rc._revision_number}`;
            const checked = selectedRelatedKeys.has(key);
            const commitSha = normalizeCommitSha((rc as any).commit);
            const subject = getRelatedChangeSubject(rc);
            const codeReviewScore = getRelatedCodeReviewScore(rc);
            
            return (
              <div 
                key={`${rc._change_number}-${rc._revision_number}`} 
                className={cn(
                  "flex items-start gap-3 px-4 py-3 text-sm transition-colors",
                  isCurrent ? "bg-purple-50/30" : "hover:bg-muted/30"
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-0.5 rounded border-border text-purple-600 focus:ring-purple-500"
                  checked={checked}
                  onChange={() => onToggleKey(key)}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <button 
                          onClick={() => navigateToChange(rc._change_number)}
                          className={cn(
                            "font-medium truncate text-left hover:underline underline-offset-2 flex-1", 
                            isCurrent ? "text-purple-700 cursor-default no-underline" : "text-foreground hover:text-primary"
                          )}
                          disabled={isCurrent}
                          title={subject}
                        >
                          {subject}
                        </button>
                        {isCurrent && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 text-purple-600 border-purple-200 bg-purple-50 shrink-0">Current</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 font-mono">
                          <GitCommit className="h-3 w-3" />
                          <span className="text-foreground/80">#{rc._change_number}</span>
                          <span className="text-muted-foreground/50">·</span>
                          <span>PS{rc._revision_number}</span>
                        </div>
                        
                        {commitSha && (
                          <span className="font-mono flex items-center gap-0.5 text-muted-foreground/70" title={`SHA: ${commitSha}`}>
                            {commitSha.slice(0, 7)}
                          </span>
                        )}

                        {codeReviewScore !== null && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'h-5 px-1.5 text-[10px] font-semibold',
                              getLabelScoreColor(codeReviewScore)
                            )}
                            title="Code-Review"
                          >
                            CR {getLabelScoreText(codeReviewScore)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant="secondary" className={cn('text-[10px] h-5', getStatusColor(rc.status))}>
                        {getStatusLabel(rc.status)}
                      </Badge>
                      <a
                        href={`${gerritUrl}/c/${rc._change_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Open in Gerrit"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      )}
    </Card>
  );
}
