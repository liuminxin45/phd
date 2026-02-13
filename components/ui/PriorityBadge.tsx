import { useState } from 'react';
import { toast } from '@/lib/toast';
import { httpClient } from '@/lib/httpClient';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { PRIORITIES, PRIORITY_BY_VALUE, NUMERIC_TO_KEY } from '@/lib/constants/priority';

interface PriorityBadgeProps {
  taskId: number;
  currentPriority: {
    value: number;
    name: string;
    color: string | { raw: string };
  };
  onPriorityChange?: (newPriority: { value: number; name: string; color: string }) => void;
}

export function PriorityBadge({ taskId, currentPriority, onPriorityChange }: PriorityBadgeProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePriorityClick = async (numericStr: string) => {
    if (numericStr === currentPriority.value.toString() || isUpdating) return;

    setIsUpdating(true);

    try {
      await httpClient('/api/tasks/update', {
        method: 'POST',
        body: {
          taskId: `T${taskId}`,
          priority: numericStr,
        },
      });

      const def = PRIORITY_BY_VALUE[parseInt(numericStr)];
      const label = def ? `${def.shortLabel} ${def.label}` : 'Unknown';
      toast.success(`优先级已更新为：${label}`);

      if (onPriorityChange) {
        onPriorityChange({
          value: parseInt(numericStr),
          name: label,
          color: def?.dotColor.replace('bg-', '') ?? 'grey',
        });
      }
    } catch (error: any) {
      toast.error(`更新优先级失败：${error.message || '未知错误'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const currentDef = PRIORITY_BY_VALUE[currentPriority.value];
  const displayName = currentDef?.shortLabel ?? currentPriority.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isUpdating}
          className={cn(
            "text-xs px-2 py-0.5 rounded whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            currentDef?.badgeColor ?? 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            isUpdating && "opacity-50 cursor-not-allowed"
          )}
        >
          {isUpdating ? '...' : displayName}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="text-xs">切换任务优先级</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PRIORITIES.map((p) => {
          const numStr = String(p.numericValue);
          const isActive = numStr === currentPriority.value.toString();
          return (
            <DropdownMenuItem
              key={numStr}
              onClick={() => handlePriorityClick(numStr)}
              className={cn("text-xs", isActive && "bg-accent/50")}
            >
              <span className="flex-1">{p.shortLabel} {p.label}</span>
              {isActive && <Check className="ml-2 h-3 w-3" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
