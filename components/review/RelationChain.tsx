import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { getStatusColor, getStatusLabel } from '@/lib/gerrit/helpers';
import type { GerritRelatedChange } from '@/lib/gerrit/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2 } from 'lucide-react';

function normalizeCommitSha(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const candidate = (value as any).commit ?? (value as any).id ?? (value as any).sha;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
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

  if (relatedChanges.length === 0) return null;

  const relatedSelectableTotal = relatedChanges.length;
  const relatedSelectedTotal = relatedChanges.filter((c) => selectedRelatedKeys.has(`${c._change_number}:${c._revision_number}`)).length;
  const relatedAllChecked = relatedSelectableTotal > 0 && relatedSelectedTotal === relatedSelectableTotal;
  const relatedSomeChecked = relatedSelectedTotal > 0 && relatedSelectedTotal < relatedSelectableTotal;

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-3.5 w-3.5"
            checked={relatedAllChecked}
            ref={(el) => {
              if (el) el.indeterminate = relatedSomeChecked;
            }}
            onChange={(e) => {
              if (e.target.checked) onSelectAll();
              else onDeselectAll();
            }}
          />
          Relation chain ({relatedSelectedTotal}/{relatedChanges.length})
        </label>
        <div className="flex items-center gap-1.5">
          {canVotePlusOne && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={batchVoting !== 0 || batchMerging}
              onClick={() => onBatchVote(1)}
            >
              {batchVoting === 1 ? <Loader2 className="h-3 w-3 animate-spin" /> : '批量 +1'}
            </Button>
          )}
          {canVotePlusTwo && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={batchVoting !== 0 || batchMerging}
              onClick={() => onBatchVote(2)}
            >
              {batchVoting === 2 ? <Loader2 className="h-3 w-3 animate-spin" /> : '批量 +2'}
            </Button>
          )}
          {canVotePlusTwo && (
            <Button
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={batchVoting !== 0 || batchMerging}
              onClick={onBatchMerge}
            >
              {batchMerging ? <Loader2 className="h-3 w-3 animate-spin" /> : '批量 Merge'}
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1">
        {relatedChanges.map((rc) => {
          const isCurrent = rc._change_number === currentChangeNumber;
          const key = `${rc._change_number}:${rc._revision_number}`;
          const checked = selectedRelatedKeys.has(key);
          const commitSha = normalizeCommitSha((rc as any).commit);
          return (
            <div key={`${rc._change_number}-${rc._revision_number}`} className="flex items-center justify-between rounded border px-2 py-1.5 text-[11px]">
              <div className="min-w-0 flex items-start gap-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 mt-0.5"
                  checked={checked}
                  onChange={() => onToggleKey(key)}
                />
                <div className="min-w-0">
                <div className="font-medium text-foreground truncate">
                  {rc.subject || `#${rc._change_number}`}
                </div>
                {commitSha && (
                  <button
                    type="button"
                    onClick={() => {
                      router.push({ pathname: '/review', query: { change: String(rc._change_number) } }, undefined, { shallow: true }).catch(() => {});
                    }}
                    className="font-mono text-[10px] text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline"
                    title={`在本项目中打开 #${rc._change_number}（${commitSha}）`}
                  >
                    {commitSha.slice(0, 12)}
                  </button>
                )}
                <div className="text-muted-foreground truncate">
                  #{rc._change_number} · PS{rc._revision_number}
                  {isCurrent ? ' (Current)' : ''}
                </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <Badge variant="outline" className={cn('text-[10px]', getStatusColor(rc.status))}>{getStatusLabel(rc.status)}</Badge>
                <a
                  href={`${gerritUrl}/c/${rc._change_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
