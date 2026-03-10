import { cn } from '@/lib/utils';
import type { GerritRevision } from '@/lib/gerrit/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Info, ArrowLeftRight } from 'lucide-react';

interface PatchSelectorProps {
  revisionsDesc: [string, GerritRevision][];
  selectedRevisionId?: string;
  baseRevisionId?: string;
  compareMode: boolean;
  compact?: boolean;
  currentRevision?: string;
  revisionCommentCounts: Record<string, number>;
  baseRevisionCandidates: [string, GerritRevision][];
  currentSubmitSignal: 'merge-conflict' | 'not-current-rebase' | null;
  onSelectRevision: (id: string) => void;
  onToggleCompare: () => void;
  onSelectBase: (id: string | undefined) => void;
  onStartCompareWith: (id: string | undefined) => void;
}

export function PatchSelector({
  revisionsDesc,
  selectedRevisionId,
  baseRevisionId,
  compareMode,
  compact,
  currentRevision,
  revisionCommentCounts,
  baseRevisionCandidates,
  currentSubmitSignal,
  onSelectRevision,
  onToggleCompare,
  onSelectBase,
  onStartCompareWith,
}: PatchSelectorProps) {
  const selectedRevision = revisionsDesc.find(([id]) => id === selectedRevisionId)?.[1];
  const selectedRevisionNumber = selectedRevision?._number;
  const baseRevision = baseRevisionId
    ? revisionsDesc.find(([id]) => id === baseRevisionId)?.[1]
    : undefined;
  const previousRevision = baseRevisionCandidates[0];
  const compareSummary = compareMode
    ? `PS${selectedRevisionNumber || '?'} vs ${baseRevision ? `PS${baseRevision._number}` : 'Parent Commit'}`
    : selectedRevisionNumber
      ? `Viewing PS${selectedRevisionNumber}`
      : 'Viewing patchset';

  if (compact) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3">
          <div className="min-w-[140px]">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Patchset Compare</div>
            <div className="text-sm font-semibold text-foreground">{compareSummary}</div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Patchset</span>
            <Select value={selectedRevisionId} onValueChange={onSelectRevision}>
              <SelectTrigger className="h-8 w-[220px] rounded-xl border-border/60 text-xs font-mono bg-background shadow-none">
                <SelectValue placeholder="Select Patch Set" />
              </SelectTrigger>
              <SelectContent>
                {revisionsDesc.map(([id, rev]) => (
                  <SelectItem key={id} value={id} className="text-xs">
                    <span className="font-mono font-medium">PS{rev._number}</span>
                    {id === currentRevision && <span className="ml-2 text-muted-foreground">(Current)</span>}
                    {revisionCommentCounts[id] > 0 && (
                      <span className="ml-auto pl-2 text-muted-foreground">
                        {revisionCommentCounts[id]} comments
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant={compareMode ? 'secondary' : 'ghost'}
            size="sm"
            className={cn('h-8 rounded-xl text-xs gap-1.5', compareMode && 'bg-primary/10 text-primary hover:bg-primary/20')}
            onClick={onToggleCompare}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {compareMode ? 'Compare Mode' : 'Compare'}
          </Button>

          {compareMode && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">vs Base</span>
              <Select
                value={baseRevisionId || 'parent'}
                onValueChange={(value) => onSelectBase(value === 'parent' ? undefined : value)}
              >
                <SelectTrigger className="h-8 w-[220px] rounded-xl border-border/60 text-xs font-mono bg-background shadow-none">
                  <SelectValue placeholder="Select Base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent" className="text-xs">Parent Commit</SelectItem>
                  {baseRevisionCandidates.map(([id, rev]) => (
                    <SelectItem key={id} value={id} className="text-xs">
                      <span className="font-mono">PS{rev._number}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!compareMode && selectedRevisionNumber && previousRevision && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl border-border/60 bg-background text-xs gap-1.5 shadow-none"
              onClick={() => onStartCompareWith(previousRevision[0])}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              With PS{previousRevision[1]._number}
            </Button>
          )}

          {!compareMode && selectedRevisionNumber && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl text-xs gap-1.5"
              onClick={() => onStartCompareWith(undefined)}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              With Parent
            </Button>
          )}
        </div>

        {currentSubmitSignal && (
          <div className="mt-3">
            <div className={cn(
              'rounded-md border px-3 py-2.5 text-xs flex items-start gap-2',
              currentSubmitSignal === 'merge-conflict'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            )}>
              {currentSubmitSignal === 'merge-conflict' ? (
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                {currentSubmitSignal === 'merge-conflict' ? (
                  <>
                    <strong>Merge Conflict Detected:</strong> This change cannot be merged automatically. Please resolve conflicts locally and upload a new patch set.
                  </>
                ) : (
                  <>
                    <strong>Not Current (Rebase Possible):</strong> The target branch has moved forward. You may need to rebase this change before merging.
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Patchset Compare</div>
            <div className="text-sm font-semibold text-foreground">{compareSummary}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedRevisionNumber && previousRevision && !compareMode && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl border-border/60 bg-background text-xs gap-1.5 shadow-none"
                onClick={() => onStartCompareWith(previousRevision[0])}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Compare with PS{previousRevision[1]._number}
              </Button>
            )}
            {selectedRevisionNumber && !compareMode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-xl text-xs gap-1.5"
                onClick={() => onStartCompareWith(undefined)}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Compare with Parent
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-muted/[0.02] px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Patchset</span>
            <Select
              value={selectedRevisionId}
              onValueChange={onSelectRevision}
            >
              <SelectTrigger className="h-8 w-[252px] rounded-xl border-border/60 text-xs font-mono bg-background shadow-none">
                <SelectValue placeholder="Select Patch Set" />
              </SelectTrigger>
              <SelectContent>
                {revisionsDesc.map(([id, rev]) => (
                  <SelectItem key={id} value={id} className="text-xs">
                    <span className="font-mono font-medium">PS{rev._number}</span>
                    {id === currentRevision && <span className="ml-2 text-muted-foreground">(Current)</span>}
                    {revisionCommentCounts[id] > 0 && (
                      <span className="ml-auto pl-2 text-muted-foreground">
                        {revisionCommentCounts[id]} comments
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant={compareMode ? 'secondary' : 'ghost'}
            size="sm"
            className={cn("h-8 rounded-xl text-xs gap-1.5", compareMode && "bg-primary/10 text-primary hover:bg-primary/20")}
            onClick={onToggleCompare}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {compareMode ? 'Compare Mode' : 'Compare'}
          </Button>

          {compareMode && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
              <span className="text-xs text-muted-foreground">vs Base</span>
              <Select
                value={baseRevisionId || 'parent'}
                onValueChange={(value) => onSelectBase(value === 'parent' ? undefined : value)}
              >
                <SelectTrigger className="h-8 w-[220px] rounded-xl border-border/60 text-xs font-mono bg-background shadow-none">
                  <SelectValue placeholder="Select Base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent" className="text-xs">Parent Commit</SelectItem>
                  {baseRevisionCandidates.map(([id, rev]) => (
                    <SelectItem key={id} value={id} className="text-xs">
                      <span className="font-mono">PS{rev._number}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {currentSubmitSignal && (
        <div className="mt-4">
          <div className={cn(
            'rounded-md border px-3 py-2.5 text-xs flex items-start gap-2',
            currentSubmitSignal === 'merge-conflict'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          )}>
            {currentSubmitSignal === 'merge-conflict' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <div className="leading-relaxed">
              {currentSubmitSignal === 'merge-conflict' ? (
                <>
                  <strong>Merge Conflict Detected:</strong> This change cannot be merged automatically. Please resolve conflicts locally and upload a new patch set.
                </>
              ) : (
                <>
                  <strong>Not Current (Rebase Possible):</strong> The target branch has moved forward. You may need to rebase this change before merging.
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
