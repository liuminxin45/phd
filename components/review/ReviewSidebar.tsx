import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  formatGerritDate,
  getAccountName,
} from '@/lib/gerrit/helpers';
import type { GerritChange } from '@/lib/gerrit/types';
import { AiReviewPanel } from './AiReviewPanel';
import { AiRulesPanel } from './AiRulesPanel';
import { ReviewPanel } from './ReviewPanel';
import { AccountSearch } from './AccountSearch';
import { Card, CardContent } from '@/components/ui/card';
import { User, UserPlus, Plus, X } from 'lucide-react';

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
  onAddDraftComment,
  onJumpToLine,
  onAddReviewer,
  onRemoveReviewer,
}: ReviewSidebarProps) {
  const [addingReviewer, setAddingReviewer] = useState(false);
  const [addingCC, setAddingCC] = useState(false);

  return (
    <div className="w-80 shrink-0 hidden lg:block space-y-4">
      <AiReviewPanel
        changeNumber={changeNumber}
        revisionId={selectedRevisionId}
        baseRevisionId={compareMode ? baseRevisionId : undefined}
        onAddDraftComment={onAddDraftComment}
        onJumpToLine={onJumpToLine}
      />

      <ReviewPanel
        onSubmit={onSubmitReview}
        availableLabels={availableLabels}
        submitting={submittingReview}
      />

      {/* Reviewers info with add/remove */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">评审者</p>
            <button onClick={() => setAddingReviewer(!addingReviewer)} className="text-muted-foreground hover:text-primary" title="添加评审者">
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          </div>
          {addingReviewer && (
            <AccountSearch
              placeholder="搜索评审者姓名或邮箱..."
              onSelect={(account) => { onAddReviewer(account, 'REVIEWER'); setAddingReviewer(false); }}
              onCancel={() => setAddingReviewer(false)}
            />
          )}
          {change.reviewers?.REVIEWER?.map((r) => (
            <div key={r._account_id} className="flex items-center justify-between group text-xs text-foreground">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <a
                  href={`${gerritUrl}/q/owner:${encodeURIComponent(r.email || r.username || getAccountName(r))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary underline-offset-2 hover:underline"
                >
                  {getAccountName(r)}
                </a>
              </div>
              <button onClick={() => onRemoveReviewer(r._account_id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity" title="移除">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between mt-3">
            <p className="text-xs font-medium text-muted-foreground">抄送</p>
            <button onClick={() => setAddingCC(!addingCC)} className="text-muted-foreground hover:text-primary" title="添加抄送">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {addingCC && (
            <AccountSearch
              placeholder="搜索抄送人姓名或邮箱..."
              onSelect={(account) => { onAddReviewer(account, 'CC'); setAddingCC(false); }}
              onCancel={() => setAddingCC(false)}
            />
          )}
          {change.reviewers?.CC?.map((r) => (
            <div key={r._account_id} className="flex items-center justify-between group text-xs text-foreground/70">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <a
                  href={`${gerritUrl}/q/owner:${encodeURIComponent(r.email || r.username || getAccountName(r))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary underline-offset-2 hover:underline"
                >
                  {getAccountName(r)}
                </a>
              </div>
              <button onClick={() => onRemoveReviewer(r._account_id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity" title="移除">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Change metadata */}
      <Card>
        <CardContent className="p-3 space-y-2 text-xs">
          <p className="font-medium text-muted-foreground">变更信息</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Change-Id</span><span className="font-mono truncate ml-2">{change.change_id?.slice(0, 12)}...</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">创建时间</span><span>{formatGerritDate(change.created)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">更新时间</span><span>{formatGerritDate(change.updated)}</span></div>
          {change.topic && <div className="flex justify-between"><span className="text-muted-foreground">Topic</span><span className="truncate ml-2">{change.topic}</span></div>}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Diff</span>
            <span>
              <span className="text-green-600">+{totalInsertions}</span>
              {' / '}
              <span className="text-red-500">-{totalDeletions}</span>
              {' · '}
              {fileCount} files
            </span>
          </div>
          {change.submittable !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">可合入</span>
              <span className={change.submittable ? 'text-green-600' : 'text-muted-foreground'}>
                {change.submittable ? '是' : '否'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <AiRulesPanel />
    </div>
  );
}
