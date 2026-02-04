import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { Calendar } from './calendar';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
  className = '',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="inline-flex items-center gap-1">
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100 rounded transition-colors border border-neutral-300 ${className}`}
          >
            <CalendarIcon className="h-3 w-3 opacity-50" />
            {value ? (
              <span>{format(value, 'yyyy/MM/dd', { locale: zhCN })}</span>
            ) : (
              <span className="text-neutral-500">{placeholder}</span>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="bg-white rounded-lg border border-neutral-200 shadow-lg p-3 z-[10200]"
            sideOffset={5}
          >
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                onChange(date);
                setIsOpen(false);
              }}
              initialFocus
            />
            {value && (
              <div className="pt-2 border-t border-neutral-200 mt-2">
                <button
                  onClick={() => {
                    onChange(undefined);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center gap-1"
                >
                  <X className="h-3 w-3" />
                  清除日期
                </button>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {value && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange(undefined);
          }}
          className="p-0.5 hover:bg-red-50 rounded transition-colors group"
          title="清除日期"
        >
          <X className="h-3 w-3 text-neutral-400 group-hover:text-red-600 transition-colors" />
        </button>
      )}
    </div>
  );
}
