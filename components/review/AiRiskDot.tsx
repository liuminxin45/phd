import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/lib/gerrit/ai-types';
import { RISK_LEVEL_META } from '@/lib/gerrit/ai-types';

interface AiRiskDotProps {
  riskLevel?: RiskLevel;
  briefReason?: string;
}

/**
 * A tiny risk indicator dot that shows on hover.
 * Designed to be "ignorable" — just a small colored dot.
 */
export function AiRiskDot({ riskLevel, briefReason }: AiRiskDotProps) {
  const [hovered, setHovered] = useState(false);

  if (!riskLevel) return null;

  const meta = RISK_LEVEL_META[riskLevel];

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={cn('h-2 w-2 rounded-full shrink-0 transition-transform', meta.dotColor, hovered && 'scale-125')}
        title={`AI: ${meta.label}`}
      />

      {/* Hover tooltip */}
      {hovered && briefReason && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none">
          <div className={cn(
            'px-2 py-1 rounded-md text-[10px] whitespace-nowrap shadow-md border',
            meta.bgColor, meta.textColor, 'border-border/50'
          )}>
            {briefReason}
          </div>
        </div>
      )}
    </div>
  );
}
