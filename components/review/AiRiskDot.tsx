import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/lib/gerrit/ai-types';
import { RISK_LEVEL_META } from '@/lib/gerrit/ai-types';
import { LiquidTooltip } from '@/components/ui/liquid-tooltip';

interface AiRiskDotProps {
  riskLevel?: RiskLevel;
  briefReason?: string;
}

/**
 * A tiny risk indicator dot that shows on hover.
 * Designed to be "ignorable" — just a small colored dot.
 */
export function AiRiskDot({ riskLevel, briefReason }: AiRiskDotProps) {
  if (!riskLevel) return null;

  const meta = RISK_LEVEL_META[riskLevel];

  return (
    <LiquidTooltip content={briefReason || `AI: ${meta.label}`}>
      <span className={cn('inline-flex h-2 w-2 rounded-full shrink-0 transition-transform hover:scale-125', meta.dotColor)} />
    </LiquidTooltip>
  );
}
