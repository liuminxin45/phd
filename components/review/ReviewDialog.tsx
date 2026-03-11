import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getLabelScoreColor } from '@/lib/gerrit/helpers';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { message: string; labels: Record<string, number> }) => Promise<void>;
  onTriggerInternalAgent?: (message: string) => Promise<void>;
  availableLabels?: string[];
  initialScores?: Record<string, number>;
  submitting?: boolean;
}

const SCORE_OPTIONS = [-2, -1, 0, 1, 2];
const HIDDEN_LABELS = ['Unit-Test', 'Lint', 'Label-Unit-Test', 'Label-Lint'];
const INTERNAL_AGENT_TRIGGER_KEY = 'review-internal-agent-trigger-message';
const DEFAULT_INTERNAL_AGENT_TRIGGER = '@AI2   ';

export function ReviewDialog({
  open,
  onOpenChange,
  onSubmit,
  onTriggerInternalAgent,
  availableLabels = ['Code-Review'],
  initialScores = {},
  submitting,
}: ReviewDialogProps) {
  const [message, setMessage] = useState('');
  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [agentTriggerMessage, setAgentTriggerMessage] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_INTERNAL_AGENT_TRIGGER;
    try {
      return localStorage.getItem(INTERNAL_AGENT_TRIGGER_KEY) ?? DEFAULT_INTERNAL_AGENT_TRIGGER;
    } catch {
      return DEFAULT_INTERNAL_AGENT_TRIGGER;
    }
  });

  const visibleLabels = availableLabels.filter((label) => !HIDDEN_LABELS.includes(label));

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setScores(initialScores);
  }, [initialScores, open]);

  const resetState = () => {
    setMessage('');
    setScores(initialScores);
  };

  const handleSubmit = async () => {
    if (!message.trim() && Object.keys(scores).length === 0) return;
    await onSubmit({ message: message.trim(), labels: scores });
    resetState();
    onOpenChange(false);
  };

  const handleAgentTriggerChange = (value: string) => {
    setAgentTriggerMessage(value);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(INTERNAL_AGENT_TRIGGER_KEY, value);
    } catch {
      // ignore
    }
  };

  const handleTriggerInternalAgent = async () => {
    if (!agentTriggerMessage.trim()) return;
    try {
      toast.info('正在发送内部 Agent 触发评论...');
      if (onTriggerInternalAgent) {
        await onTriggerInternalAgent(agentTriggerMessage);
      } else {
        await onSubmit({ message: agentTriggerMessage, labels: {} });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || '触发失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[24px] border-border/60 p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/40 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Submit Review
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Review Comment</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your review comment..."
              className="min-h-[120px] resize-y bg-muted/[0.02] text-sm shadow-none"
              disabled={submitting}
            />
          </div>

          <div className="space-y-3">
            {visibleLabels.map((label) => (
              <div key={label} className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {label === 'Code-Review' ? 'Code-Review' : label}
                </span>
                <div className="flex items-center gap-2">
                  {SCORE_OPTIONS.map((score) => {
                    const isSelected = scores[label] === score;
                    return (
                      <button
                        key={score}
                        onClick={() => {
                          setScores((prev) => {
                            const next = { ...prev };
                            if (prev[label] === score) delete next[label];
                            else next[label] = score;
                            return next;
                          });
                        }}
                        className={cn(
                          'h-9 min-w-14 rounded-xl border text-sm font-medium transition-all',
                          isSelected
                            ? cn(getLabelScoreColor(score), 'shadow-sm ring-1 ring-black/5')
                            : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        )}
                        disabled={submitting}
                      >
                        {score > 0 ? `+${score}` : score}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/[0.02] p-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">内部 Agent 触发</div>
            <div className="flex gap-2">
              <Input
                value={agentTriggerMessage}
                onChange={(e) => handleAgentTriggerChange(e.target.value)}
                placeholder="@AI2"
                className="h-9 shadow-none"
                disabled={submitting}
              />
              <Button
                variant="outline"
                className="h-9 shrink-0"
                onClick={handleTriggerInternalAgent}
                disabled={submitting || !agentTriggerMessage.trim()}
              >
                Trigger
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/40 px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || (!message.trim() && Object.keys(scores).length === 0)}
            className="gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
