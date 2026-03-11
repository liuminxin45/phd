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
import { Plus, User, Users, X } from 'lucide-react';

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

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border/50 bg-card shadow-none">
      <div className="px-4 py-3.5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Review Team
          </div>
        </div>

        <div className="space-y-3">
          <section className="min-w-0">
            <div className="flex items-start gap-4">
              <span className="w-16 shrink-0 pt-2 text-xs font-medium text-foreground/80">Reviewer</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {change.reviewers?.REVIEWER?.map((reviewer) => (
                    <div key={reviewer._account_id} className="group flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background px-2.5 py-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
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
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                        aria-label="Remove reviewer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground"
                    onClick={() => setAddingReviewer((prev) => !prev)}
                    aria-label="Add reviewer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  {(!change.reviewers?.REVIEWER || change.reviewers.REVIEWER.length === 0) && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">No reviewers</p>
                  )}
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
              </div>
            </div>
          </section>

          <section className="min-w-0">
            <div className="flex items-start gap-4">
              <span className="w-16 shrink-0 pt-2 text-xs font-medium text-foreground/80">CC</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {change.reviewers?.CC?.map((reviewer) => (
                    <div key={reviewer._account_id} className="group flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background px-2.5 py-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
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
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                        aria-label="Remove CC"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground"
                    onClick={() => setAddingCC((prev) => !prev)}
                    aria-label="Add CC"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  {(!change.reviewers?.CC || change.reviewers.CC.length === 0) && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">No CCs</p>
                  )}
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
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
