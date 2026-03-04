import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  formatGerritDate,
  getAccountName,
  getLabelScoreColor,
  getLabelScoreText,
} from '@/lib/gerrit/helpers';
import type { GerritChange } from '@/lib/gerrit/types';
import { AiReviewPanel } from './AiReviewPanel';
import { AiRulesPanel } from './AiRulesPanel';
import { ReviewPanel } from './ReviewPanel';
import { AccountSearch } from './AccountSearch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, UserPlus, Plus, X, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReviewSidebarProps {
  change: GerritChange;
  gerritUrl: string;
  changeNumber: number;
  selectedRevisionId?: string;
  compareMode: boolean;
  baseRevisionId?: string;
  availableLabels: string[];
  submittingReview: boolean;
  totalInsertions: number;
  totalDeletions: number;
  fileCount: number;
  onSubmitReview: (data: { message: string; labels: Record<string, number> }) => Promise<void>;
  onTriggerInternalAgent: (message: string) => Promise<void>;
  onAddDraftComment: (file: string, line: number, message: string) => void;
  onJumpToLine: (file: string, line: number) => void;
  onAddReviewer: (account: { _account_id: number; email?: string; name?: string }, state: 'REVIEWER' | 'CC') => void;
  onRemoveReviewer: (accountId: number) => void;
}

export function ReviewSidebar({
  change,
  gerritUrl,
  changeNumber,
  selectedRevisionId,
  compareMode,
  baseRevisionId,
  availableLabels,
  submittingReview,
  totalInsertions,
  totalDeletions,
  fileCount,
  onSubmitReview,
  onTriggerInternalAgent,
  onAddDraftComment,
  onJumpToLine,
  onAddReviewer,
  onRemoveReviewer,
}: ReviewSidebarProps) {
  const [addingReviewer, setAddingReviewer] = useState(false);
  const [addingCC, setAddingCC] = useState(false);
  const codeReviewLabel = change.labels?.['Code-Review'] || change.labels?.['Label-Code-Review'];
  const reviewerScoreMap = new Map<number, number>();

  for (const approval of codeReviewLabel?.all || []) {
    if (!approval?._account_id || typeof approval.value !== 'number') continue;
    reviewerScoreMap.set(approval._account_id, approval.value);
  }

  return (
    <div className="w-80 shrink-0 hidden lg:block space-y-6">
      {/* AI Analysis */}
      <AiReviewPanel
        changeNumber={changeNumber}
        revisionId={selectedRevisionId}
        baseRevisionId={compareMode ? baseRevisionId : undefined}
        onAddDraftComment={onAddDraftComment}
        onJumpToLine={onJumpToLine}
      />

      {/* Review Actions */}
      <ReviewPanel
        onSubmit={onSubmitReview}
        onTriggerInternalAgent={onTriggerInternalAgent}
        availableLabels={availableLabels}
        submitting={submittingReview}
      />

      {/* People (Reviewers & CC) */}
      <Card>
        <CardHeader className="px-4 py-3 border-b border-border/40">
           <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            People
           </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-5">
          {/* Reviewers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reviewers</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 text-muted-foreground hover:text-primary" 
                onClick={() => setAddingReviewer(!addingReviewer)}
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            {addingReviewer && (
              <div className="mb-2">
                <AccountSearch
                  placeholder="Search name or email..."
                  onSelect={(account) => { onAddReviewer(account, 'REVIEWER'); setAddingReviewer(false); }}
                  onCancel={() => setAddingReviewer(false)}
                />
              </div>
            )}
            
            <div className="space-y-1">
              {change.reviewers?.REVIEWER?.map((r) => (
                <div key={r._account_id} className="flex items-center justify-between group text-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a
                      href={`${gerritUrl}/q/owner:${encodeURIComponent(r.email || r.username || getAccountName(r))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:text-primary transition-colors"
                      title={getAccountName(r)}
                    >
                      {getAccountName(r)}
                    </a>
                    {reviewerScoreMap.has(r._account_id) && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'h-5 px-1.5 text-[10px] font-semibold',
                          getLabelScoreColor(reviewerScoreMap.get(r._account_id) as number)
                        )}
                        title="Code-Review score"
                      >
                        {getLabelScoreText(reviewerScoreMap.get(r._account_id) as number)}
                      </Badge>
                    )}
                  </div>
                  <button 
                    onClick={() => onRemoveReviewer(r._account_id)} 
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {(!change.reviewers?.REVIEWER || change.reviewers.REVIEWER.length === 0) && (
                <p className="text-xs text-muted-foreground italic pl-1">No reviewers</p>
              )}
            </div>
          </div>

          <Separator />

          {/* CC */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CC</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 text-muted-foreground hover:text-primary" 
                onClick={() => setAddingCC(!addingCC)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {addingCC && (
              <div className="mb-2">
                <AccountSearch
                  placeholder="Search name or email..."
                  onSelect={(account) => { onAddReviewer(account, 'CC'); setAddingCC(false); }}
                  onCancel={() => setAddingCC(false)}
                />
              </div>
            )}

            <div className="space-y-1">
              {change.reviewers?.CC?.map((r) => (
                <div key={r._account_id} className="flex items-center justify-between group text-sm text-muted-foreground/80">
                   <div className="flex items-center gap-2 overflow-hidden">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a
                      href={`${gerritUrl}/q/owner:${encodeURIComponent(r.email || r.username || getAccountName(r))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:text-primary transition-colors"
                      title={getAccountName(r)}
                    >
                      {getAccountName(r)}
                    </a>
                  </div>
                  <button 
                    onClick={() => onRemoveReviewer(r._account_id)} 
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {(!change.reviewers?.CC || change.reviewers.CC.length === 0) && (
                <p className="text-xs text-muted-foreground italic pl-1">No CCs</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Info */}
      <Card>
        <CardHeader className="px-4 py-3 border-b border-border/40">
           <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4" />
            Metadata
           </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Change-Id</span>
            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[140px]" title={change.change_id}>
              {change.change_id?.slice(0, 12)}...
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Created</span>
            <span>{formatGerritDate(change.created)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Updated</span>
            <span>{formatGerritDate(change.updated)}</span>
          </div>
          {change.topic && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Topic</span>
              <Badge variant="outline" className="text-[10px] h-5 font-normal">{change.topic}</Badge>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Diff</span>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 font-medium">+{totalInsertions}</span>
              <span className="text-rose-500 font-medium">-{totalDeletions}</span>
              <span className="text-muted-foreground">in {fileCount} files</span>
            </div>
          </div>
          {change.submittable !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Submittable</span>
              <Badge variant={change.submittable ? "outline" : "secondary"} className={cn("text-[10px] h-5", change.submittable ? "text-green-600 border-green-200 bg-green-50" : "text-muted-foreground")}>
                {change.submittable ? 'Yes' : 'No'}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <AiRulesPanel />
    </div>
  );
}
