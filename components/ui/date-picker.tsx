import * as React from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 px-2 text-xs font-normal justify-start text-left",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-50" />
            {value ? (
              format(value, 'yyyy/MM/dd', { locale: zhCN })
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[10200]" align="start">
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
            <div className="p-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
              >
                <X className="mr-1 h-3 w-3" />
                清除日期
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value && (
         <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            title="清除日期"
          >
            <X className="h-3.5 w-3.5" />
         </Button>
      )}
    </div>
  );
}
