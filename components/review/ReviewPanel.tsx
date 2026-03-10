import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getLabelScoreColor } from '@/lib/gerrit/helpers';
import { Button } from '@/components/ui/button';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ReviewPanelProps {
  onSubmit: (data: { message: string; labels: Record<string, number> }) => Promise<void>;
  onTriggerInternalAgent?: (message: string) => Promise<void>;
  availableLabels?: string[];
  submitting?: boolean;
}

const SCORE_OPTIONS = [-2, -1, 0, 1, 2];
const HIDDEN_LABELS = ['Unit-Test', 'Lint', 'Label-Unit-Test', 'Label-Lint'];
const INTERNAL_AGENT_TRIGGER_KEY = 'review-internal-agent-trigger-message';
const DEFAULT_INTERNAL_AGENT_TRIGGER = '@AI2   ';

export function ReviewPanel({ onSubmit, onTriggerInternalAgent, availableLabels = ['Code-Review'], submitting }: ReviewPanelProps) {
  const [message, setMessage] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [agentTriggerMessage, setAgentTriggerMessage] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_INTERNAL_AGENT_TRIGGER;
    try {
      const saved = localStorage.getItem(INTERNAL_AGENT_TRIGGER_KEY);
      return saved ?? DEFAULT_INTERNAL_AGENT_TRIGGER;
    } catch {
      return DEFAULT_INTERNAL_AGENT_TRIGGER;
    }
  });

  const visibleLabels = availableLabels.filter((l) => !HIDDEN_LABELS.includes(l));

  const handleSubmit = async () => {
    if (!message.trim() && Object.keys(scores).length === 0) return;
    await onSubmit({ message: message.trim(), labels: scores });
    setMessage('');
    setScores({});
  };

  const handleAgentTriggerChange = (value: string) => {
    setAgentTriggerMessage(value);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(INTERNAL_AGENT_TRIGGER_KEY, value);
    } catch {
      // ignore localStorage errors
    }
  };

  const handleTriggerInternalAgent = async () => {
    if (!agentTriggerMessage.trim()) return;
    try {
      toast.info('正在发送内部 Agent 触发评论...');
      if (onTriggerInternalAgent) {
        await onTriggerInternalAgent(agentTriggerMessage);
        return;
      }
      await onSubmit({ message: agentTriggerMessage, labels: {} });
    } catch (err: any) {
      toast.error(err?.message || '触发失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card className="border border-border/60 shadow-none bg-card/95">
      <CardHeader className="px-4 py-3 border-b border-border/30">
        <CardTitle className="text-[13px] font-medium flex items-center gap-2 text-foreground/85">
          <MessageSquare className="h-4 w-4" />
          Submit Review
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Comment textarea */}
        <div className="space-y-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your review comment..."
            className="min-h-[92px] text-sm resize-y shadow-none bg-muted/[0.02]"
            disabled={submitting}
          />
          <p className="text-[10px] text-muted-foreground text-right">
            Cmd/Ctrl + Enter to submit
          </p>
        </div>

        {/* Label scores */}
        <div className="space-y-3">
          {visibleLabels.map((label) => (
            <div key={label} className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground block">
                {label === 'Code-Review' ? 'Code-Review' : label === 'Verified' ? 'Verified' : label}
              </span>
              <div className="flex items-center gap-1 w-full">
                {SCORE_OPTIONS.map((score) => {
                  const isSelected = scores[label] === score;
                  const colorClass = isSelected ? getLabelScoreColor(score) : '';
                  return (
                    <button
                      key={score}
                      onClick={() => {
                        setScores((prev) => {
                          const next = { ...prev };
                          if (prev[label] === score) {
                            delete next[label];
                          } else {
                            next[label] = score;
                          }
                          return next;
                        });
                      }}
                      className={cn(
                        'flex-1 h-8 rounded-md text-xs font-medium border transition-all shadow-none',
                        isSelected
                          ? cn(colorClass, 'shadow-sm ring-1 ring-black/5')
                          : 'border-border/60 text-muted-foreground bg-muted/[0.03] hover:bg-muted/[0.08] hover:text-foreground'
                      )}
                      disabled={submitting}
                      title={score > 0 ? `+${score}` : `${score}`}
                    >
                      {score > 0 ? `+${score}` : score}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit button */}
        <div className="pt-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || (!message.trim() && Object.keys(scores).length === 0)}
            className="w-full gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>

        <div className="pt-2 border-t border-border/40 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">内部 Agent 触发</p>
          <Input
            value={agentTriggerMessage}
            onChange={(e) => handleAgentTriggerChange(e.target.value)}
            placeholder="例如：@AI2"
            className="h-8 text-xs shadow-none bg-muted/[0.02]"
            disabled={submitting}
          />
          <p className="text-[10px] text-muted-foreground">点击按钮会发送一条评论以触发公司内部评审 Agent</p>
          <Button
            variant="outline"
            className="w-full h-8 text-xs"
            onClick={handleTriggerInternalAgent}
            disabled={submitting || !agentTriggerMessage.trim()}
          >
            触发内部 Agent 评审
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
