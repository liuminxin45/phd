import { cn } from '@/lib/utils';
import { getLabelScoreColor, getLabelScoreText, getLabelMaxScore } from '@/lib/gerrit/helpers';
import type { GerritLabelInfo } from '@/lib/gerrit/types';
import { Check, X, Minus } from 'lucide-react';

interface LabelBadgeProps {
  name: string;
  label: GerritLabelInfo;
  compact?: boolean;
}

export function LabelBadge({ name, label, compact }: LabelBadgeProps) {
  const score = getLabelMaxScore(label);
  const colorClass = getLabelScoreColor(score);
  const scoreText = getLabelScoreText(score);

  // Readable label names
  const LABEL_NAMES: Record<string, string> = {
    'Code-Review': 'Code Review',
    'Verified': 'Verified',
    'Label-Verified': 'Verified',
    'Label-Code-Review': 'Code Review',
    'Unit-Test': 'Unit Test',
    'Lint': 'Lint',
  };
  const shortName = LABEL_NAMES[name] || name.replace(/-/g, ' ');

  const icon = score >= 2 ? <Check className="h-3 w-3" /> :
               score <= -2 ? <X className="h-3 w-3" /> :
               score === 0 ? <Minus className="h-3 w-3" /> : null;

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium border', colorClass)}>
        {shortName}{scoreText}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border', colorClass)}>
      {icon}
      <span>{shortName} {scoreText}</span>
    </span>
  );
}

interface LabelsSummaryProps {
  labels?: Record<string, GerritLabelInfo>;
  compact?: boolean;
}

export function LabelsSummary({ labels, compact }: LabelsSummaryProps) {
  if (!labels) return null;

  // Show Code-Review and Verified first, then others
  const orderedKeys = Object.keys(labels).sort((a, b) => {
    if (a === 'Code-Review') return -1;
    if (b === 'Code-Review') return 1;
    if (a === 'Verified') return -1;
    if (b === 'Verified') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {orderedKeys.map((key) => (
        <LabelBadge key={key} name={key} label={labels[key]} compact={compact} />
      ))}
    </div>
  );
}
