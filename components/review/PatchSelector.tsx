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
  currentRevision?: string;
  revisionCommentCounts: Record<string, number>;
  baseRevisionCandidates: [string, GerritRevision][];
  currentSubmitSignal: 'merge-conflict' | 'not-current-rebase' | null;
  onSelectRevision: (id: string) => void;
  onToggleCompare: () => void;
  onSelectBase: (id: string | undefined) => void;
}

export function PatchSelector({
  revisionsDesc,
  selectedRevisionId,
  baseRevisionId,
  compareMode,
  currentRevision,
  revisionCommentCounts,
  baseRevisionCandidates,
  currentSubmitSignal,
  onSelectRevision,
  onToggleCompare,
  onSelectBase,
}: PatchSelectorProps) {
  return (
    <>
      <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Patchset</span>
          <Select
            value={selectedRevisionId}
            onValueChange={onSelectRevision}
          >
            <SelectTrigger className="h-8 w-[240px] text-xs font-mono bg-background">
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
          className={cn("h-8 text-xs gap-1.5", compareMode && "bg-primary/10 text-primary hover:bg-primary/20")}
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
              <SelectTrigger className="h-8 w-[200px] text-xs font-mono bg-background">
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
