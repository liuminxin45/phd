import { Send } from 'lucide-react';

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

const VARIANT_CLASSES = {
  primary: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  danger: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
} as const;

export function ApplyButtons({ onApply, disabled, showIcon = true, variant = 'primary' }: ApplyButtonsProps) {
  return (
    <>
      {APPLY_OPTIONS.map(({ label, date, times }) => (
        <button
          key={label}
          onClick={() => onApply(date, times)}
          disabled={disabled}
          className={`px-2 py-1 text-xs rounded border disabled:opacity-50 ${VARIANT_CLASSES[variant]}`}
        >
          {showIcon && <Send className="w-3 h-3 inline mr-1" />}
          {label}
        </button>
      ))}
    </>
  );
}
