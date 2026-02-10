import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const APPLY_OPTIONS = [
  { label: '今天1次', date: 0, times: 1 },
  { label: '今天2次', date: 0, times: 2 },
  { label: '昨天1次', date: -1, times: 1 },
  { label: '昨天2次', date: -1, times: 2 },
  { label: '取消今天', date: 0, times: 0 },
] as const;

export { APPLY_OPTIONS };

interface ApplyButtonsProps {
  onApply: (date: number, times: number) => void;
  disabled: boolean;
  showIcon?: boolean;
  variant?: 'primary' | 'danger';
}

export function ApplyButtons({ onApply, disabled, showIcon = true, variant = 'primary' }: ApplyButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {APPLY_OPTIONS.map(({ label, date, times }) => (
        <Button
          key={label}
          onClick={() => onApply(date, times)}
          disabled={disabled}
          variant={variant === 'danger' ? 'destructive' : 'outline'}
          size="sm"
          className={cn(
            "h-7 text-xs px-2",
            variant === 'primary' && "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 hover:text-orange-800"
          )}
        >
          {showIcon && <Send className="w-3 h-3 mr-1" />}
          {label}
        </Button>
      ))}
    </div>
  );
}
