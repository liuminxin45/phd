import { formatGerritDate } from '@/lib/gerrit/helpers';
import type { GerritRevision } from '@/lib/gerrit/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';

export const PARENT_PATCHSET_ID = '__parent__';

interface PatchSelectorProps {
  revisionsDesc: [string, GerritRevision][];
  selectedRevisionId?: string;
  baseRevisionId?: string;
  currentRevision?: string;
  revisionCommentCounts: Record<string, number>;
  onSelectRevision: (id: string) => void;
  onSelectBase: (id: string) => void;
  onResetCompare: () => void;
}

function renderPatchsetOption(
  id: string,
  rev: GerritRevision,
  currentRevision: string | undefined,
  revisionCommentCounts: Record<string, number>
) {
  return (
    <SelectItem key={id} value={id} className="text-xs">
      <div className="flex w-full min-w-0 items-center gap-2">
        <span className="font-mono font-medium">PS{rev._number}</span>
        {id === currentRevision && <span className="text-muted-foreground">(Current)</span>}
        <span className="truncate text-muted-foreground">{formatGerritDate(rev.created)}</span>
        {revisionCommentCounts[id] > 0 && (
          <span className="ml-auto pl-2 text-muted-foreground">
            {revisionCommentCounts[id]} comments
          </span>
        )}
      </div>
    </SelectItem>
  );
}

export function PatchSelector({
  revisionsDesc,
  selectedRevisionId,
  baseRevisionId,
  currentRevision,
  revisionCommentCounts,
  onSelectRevision,
  onSelectBase,
  onResetCompare,
}: PatchSelectorProps) {
  const selectedRevision = revisionsDesc.find(([id]) => id === selectedRevisionId)?.[1];
  const baseRevision = revisionsDesc.find(([id]) => id === baseRevisionId)?.[1];
  const baseOptions = revisionsDesc.filter(([, rev]) => !selectedRevision || rev._number < selectedRevision._number);
  const targetOptions = revisionsDesc.filter(([, rev]) => !baseRevision || rev._number > baseRevision._number);

  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      <Select value={baseRevisionId} onValueChange={onSelectBase}>
        <SelectTrigger className="h-8 w-[156px] rounded-xl border-border/60 bg-background font-mono text-xs shadow-none">
          <SelectValue placeholder="Base" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PARENT_PATCHSET_ID} className="text-xs">
            <div className="flex w-full min-w-0 items-center gap-2">
              <span className="font-mono font-medium">PS0</span>
              <span className="truncate text-muted-foreground">Parent / old code</span>
            </div>
          </SelectItem>
          {baseOptions.map(([id, rev]) => renderPatchsetOption(id, rev, currentRevision, revisionCommentCounts))}
        </SelectContent>
      </Select>

      <Select value={selectedRevisionId} onValueChange={onSelectRevision}>
        <SelectTrigger className="h-8 w-[156px] rounded-xl border-border/60 bg-background font-mono text-xs shadow-none">
          <SelectValue placeholder="Target" />
        </SelectTrigger>
        <SelectContent>
          {targetOptions.map(([id, rev]) => renderPatchsetOption(id, rev, currentRevision, revisionCommentCounts))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-xl border-border/60 bg-background shadow-none"
        onClick={onResetCompare}
        title="Clear filter"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
