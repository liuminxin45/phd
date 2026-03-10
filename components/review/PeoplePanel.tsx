import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  getAccountName,
  getLabelScoreColor,
  getLabelScoreText,
} from '@/lib/gerrit/helpers';
import type { GerritChange } from '@/lib/gerrit/types';
import { AccountSearch } from './AccountSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, User, UserPlus, Users, X } from 'lucide-react';

interface PeoplePanelProps {
  change: GerritChange;
  gerritUrl: string;
  onAddReviewer: (account: { _account_id: number; email?: string; name?: string }, state: 'REVIEWER' | 'CC') => void;
  onRemoveReviewer: (accountId: number) => void;
}

export function PeoplePanel({
  change,
  gerritUrl,
  onAddReviewer,
  onRemoveReviewer,
}: PeoplePanelProps) {
  const [addingReviewer, setAddingReviewer] = useState(false);
  const [addingCC, setAddingCC] = useState(false);
  const codeReviewLabel = change.labels?.['Code-Review'] || change.labels?.['Label-Code-Review'];
  const reviewerScoreMap = new Map<number, number>();

  for (const approval of codeReviewLabel?.all || []) {
    if (!approval?._account_id || typeof approval.value !== 'number') continue;
    reviewerScoreMap.set(approval._account_id, approval.value);
  }

  const reviewerCount = change.reviewers?.REVIEWER?.length || 0;
  const ccCount = change.reviewers?.CC?.length || 0;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border/50 bg-card shadow-none">
      <div className="px-4 py-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Review Team
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{reviewerCount} reviewers</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{ccCount} cc</span>
        </div>
      </div>

      <div className="space-y-3">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground/80">Reviewers</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground"
              onClick={() => setAddingReviewer((prev) => !prev)}
              aria-label="Add reviewer"
            >
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {addingReviewer && (
            <AccountSearch
              placeholder="Search reviewer"
              onSelect={(account) => {
                onAddReviewer(account, 'REVIEWER');
                setAddingReviewer(false);
              }}
              onCancel={() => setAddingReviewer(false)}
            />
          )}

          <div className="space-y-1">
            {change.reviewers?.REVIEWER?.map((reviewer) => (
              <div key={reviewer._account_id} className="group flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-muted/35">
                <div className="flex min-w-0 items-center gap-2">
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <a
                    href={`${gerritUrl}/q/owner:${encodeURIComponent(reviewer.email || reviewer.username || getAccountName(reviewer))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm text-foreground/90 transition-colors hover:text-primary"
                    title={getAccountName(reviewer)}
                  >
                    {getAccountName(reviewer)}
                  </a>
                  {reviewerScoreMap.has(reviewer._account_id) && (
                    <Badge
                      variant="outline"
                      className={cn('h-5 px-1.5 text-[10px] font-semibold', getLabelScoreColor(reviewerScoreMap.get(reviewer._account_id) as number))}
                      title="Code-Review score"
                    >
                      {getLabelScoreText(reviewerScoreMap.get(reviewer._account_id) as number)}
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => onRemoveReviewer(reviewer._account_id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                  aria-label="Remove reviewer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {(!change.reviewers?.REVIEWER || change.reviewers.REVIEWER.length === 0) && (
              <p className="px-2 py-1 text-xs text-muted-foreground">No reviewers</p>
            )}
          </div>
        </section>

        <Separator />

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground/80">CC</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground"
              onClick={() => setAddingCC((prev) => !prev)}
              aria-label="Add CC"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {addingCC && (
            <AccountSearch
              placeholder="Search CC"
              onSelect={(account) => {
                onAddReviewer(account, 'CC');
                setAddingCC(false);
              }}
              onCancel={() => setAddingCC(false)}
            />
          )}

          <div className="space-y-1">
            {change.reviewers?.CC?.map((reviewer) => (
              <div key={reviewer._account_id} className="group flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-muted/35">
                <div className="flex min-w-0 items-center gap-2">
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <a
                    href={`${gerritUrl}/q/owner:${encodeURIComponent(reviewer.email || reviewer.username || getAccountName(reviewer))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm text-foreground/75 transition-colors hover:text-primary"
                    title={getAccountName(reviewer)}
                  >
                    {getAccountName(reviewer)}
                  </a>
                </div>
                <button
                  onClick={() => onRemoveReviewer(reviewer._account_id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                  aria-label="Remove CC"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {(!change.reviewers?.CC || change.reviewers.CC.length === 0) && (
              <p className="px-2 py-1 text-xs text-muted-foreground">No CCs</p>
            )}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
