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
      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Patch</span>
        <Select
          value={selectedRevisionId}
          onValueChange={onSelectRevision}
        >
          <SelectTrigger className="h-8 w-[210px] text-xs">
            <SelectValue placeholder="选择 Patch Set" />
          </SelectTrigger>
          <SelectContent>
            {revisionsDesc.map(([id, rev]) => (
              <SelectItem key={id} value={id}>
                PS{rev._number}
                {id === currentRevision ? ' (Current)' : ''}
                {' · '}
                {revisionCommentCounts[id] || 0} 评论
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={compareMode ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={onToggleCompare}
        >
          {compareMode ? '对比中' : '对比 Patch'}
        </Button>

        {compareMode && (
          <>
            <span className="text-xs text-muted-foreground">Base</span>
            <Select
              value={baseRevisionId || 'parent'}
              onValueChange={(value) => onSelectBase(value === 'parent' ? undefined : value)}
            >
              <SelectTrigger className="h-8 w-[210px] text-xs">
                <SelectValue placeholder="选择 Base Patch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Parent Commit</SelectItem>
                {baseRevisionCandidates.map(([id, rev]) => (
                  <SelectItem key={id} value={id}>
                    PS{rev._number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {currentSubmitSignal && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className={cn(
            'rounded-md border px-3 py-2 text-xs',
            currentSubmitSignal === 'merge-conflict'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          )}>
            {currentSubmitSignal === 'merge-conflict'
              ? '检测到 Gerrit Merge Conflict：当前提交无法直接合入，请先处理冲突。'
              : '检测到 Gerrit Not current + rebase possible：建议先 rebase 到最新目标分支后再合入。'}
          </div>
        </div>
      )}
    </>
  );
}
