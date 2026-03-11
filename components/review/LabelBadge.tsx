import { cn } from '@/lib/utils';
import { getLabelScoreColor, getLabelScoreText, getLabelMaxScore } from '@/lib/gerrit/helpers';
import type { GerritLabelInfo } from '@/lib/gerrit/types';
import { Check, X, Minus } from 'lucide-react';
import { LiquidTooltip } from '@/components/ui/liquid-tooltip';

const LABEL_DISPLAY_NAMES: Record<string, string> = {
  'Code-Review': 'Code Review',
  'Verified': 'Verified',
  'Label-Verified': 'Verified',
  'Label-Code-Review': 'Code Review',
  'Unit-Test': 'Unit Test',
  'Lint': 'Lint',
};

interface LabelBadgeProps {
  name: string;
  label: GerritLabelInfo;
  compact?: boolean;
}

export function LabelBadge({ name, label, compact }: LabelBadgeProps) {
  const score = getLabelMaxScore(label);
  const colorClass = getLabelScoreColor(score);
  const scoreText = getLabelScoreText(score);
  const shortName = LABEL_DISPLAY_NAMES[name] || name.replace(/-/g, ' ');

  const icon = score >= 2 ? <Check className="h-3 w-3" /> :
               score <= -2 ? <X className="h-3 w-3" /> :
               score === 0 ? <Minus className="h-3 w-3" /> : null;

  if (compact) {
    const compactName = shortName === 'Code Review' ? 'CR' : shortName;
    return (
      <LiquidTooltip content={`${shortName} ${scoreText}`}>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] leading-none font-medium border',
            colorClass
          )}
        >
          {icon}
          <span>{compactName} {scoreText}</span>
        </span>
      </LiquidTooltip>
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

  const orderedKeys = Object.keys(labels)
    .filter((key) => key === 'Code-Review' || key === 'Label-Code-Review')
    .sort((a, b) => a.localeCompare(b));

  if (orderedKeys.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {orderedKeys.map((key) => (
        <LabelBadge key={key} name={key} label={labels[key]} compact={compact} />
      ))}
    </div>
  );
}
