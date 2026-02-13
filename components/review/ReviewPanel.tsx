import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getLabelScoreColor } from '@/lib/gerrit/helpers';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';

interface ReviewPanelProps {
  onSubmit: (data: { message: string; labels: Record<string, number> }) => Promise<void>;
  availableLabels?: string[];
  submitting?: boolean;
}

const SCORE_OPTIONS = [-2, -1, 0, 1, 2];

const HIDDEN_LABELS = ['Unit-Test', 'Lint', 'Label-Unit-Test', 'Label-Lint'];

export function ReviewPanel({ onSubmit, availableLabels = ['Code-Review'], submitting }: ReviewPanelProps) {
  const [message, setMessage] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});

  const visibleLabels = availableLabels.filter((l) => !HIDDEN_LABELS.includes(l));

  const handleSubmit = async () => {
    if (!message.trim() && Object.keys(scores).length === 0) return;
    await onSubmit({ message: message.trim(), labels: scores });
    setMessage('');
    setScores({});
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="px-3 py-2 bg-muted/50 border-b">
        <span className="text-sm font-medium text-foreground">提交评审</span>
      </div>
      <div className="p-3 space-y-3">
        {/* Comment textarea */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="写下你的评审意见... (Ctrl+Enter 提交)"
          className="w-full min-h-[80px] p-2.5 rounded-md border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          disabled={submitting}
        />

        {/* Label scores */}
        {visibleLabels.map((label) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">
              {label === 'Code-Review' ? 'Code-Review' : label === 'Verified' ? 'Verified' : label}
            </span>
            <div className="flex items-center gap-1">
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
                      'h-7 w-9 rounded text-xs font-medium border transition-all',
                      isSelected
                        ? colorClass
                        : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
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

        {/* Submit button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting || (!message.trim() && Object.keys(scores).length === 0)}
            size="sm"
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {submitting ? '提交中...' : '提交 Review'}
          </Button>
        </div>
      </div>
    </div>
  );
}
