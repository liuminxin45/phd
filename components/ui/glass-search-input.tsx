import * as React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { glassInputClass, glassToolbarClass } from '@/components/ui/glass';
import { cn } from '@/lib/utils';

interface GlassSearchInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  containerClassName?: string;
  toolbarClassName?: string;
  actions?: React.ReactNode;
  inputClassName?: string;
  loading?: boolean;
}

export function GlassSearchInput({
  className,
  containerClassName,
  toolbarClassName,
  actions,
  inputClassName,
  loading = false,
  ...props
}: GlassSearchInputProps) {
  return (
    <div className={cn(glassToolbarClass, 'flex items-center gap-3 p-2', toolbarClassName, containerClassName)}>
      <div className="group/search relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-500/85 transition-all duration-200 ease-out group-focus-within/search:-translate-y-[58%] group-focus-within/search:text-sky-600" />
        <Input
          type="text"
          className={cn(
            glassInputClass,
            'h-9 rounded-xl pl-9 pr-8 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:outline-none',
            'focus:border-white/55 focus-visible:border-white/55',
            inputClassName,
            className
          )}
          {...props}
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-500/85" />
        )}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
