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

interface PriorityBadgeProps {
  taskId: number;
  currentPriority: {
    value: number;
    name: string;
    color: string | { raw: string };
  };
  onPriorityChange?: (newPriority: { value: number; name: string; color: string }) => void;
}

interface PriorityOption {
  key: string;
  name: string;
  color: string;
}

const PRIORITY_OPTIONS: Record<string, PriorityOption> = {
  '100': { key: '100', name: 'P1 紧急', color: 'pink' },
  '90': { key: '90', name: 'P2 高', color: 'violet' },
  '80': { key: '80', name: 'P3 中', color: 'red' },
  '50': { key: '50', name: 'P4 普通', color: 'yellow' },
  '25': { key: '25', name: 'P5 低', color: 'sky' },
  '0': { key: '0', name: 'P6 微不足道', color: 'slate' },
};

// Updated names to match general usage if needed, or keep short names
const PRIORITY_LABELS: Record<string, string> = {
  '100': 'P1',
  '90': 'P2',
  '80': 'P3',
  '50': 'P4',
  '25': 'P5',
  '0': 'P6',
};

function getPriorityColor(value: number): string {
  if (value >= 100) return 'bg-pink-100 text-pink-700 hover:bg-pink-200';
  if (value >= 90) return 'bg-violet-100 text-violet-700 hover:bg-violet-200';
  if (value >= 80) return 'bg-red-100 text-red-700 hover:bg-red-200';
  if (value >= 50) return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200';
  if (value >= 25) return 'bg-sky-100 text-sky-700 hover:bg-sky-200';
  return 'bg-slate-100 text-slate-700 hover:bg-slate-200';
}

export function PriorityBadge({ taskId, currentPriority, onPriorityChange }: PriorityBadgeProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePriorityClick = async (newPriorityValue: string) => {
    if (newPriorityValue === currentPriority.value.toString() || isUpdating) return;

    setIsUpdating(true);

    try {
      await httpClient('/api/tasks/update', {
        method: 'POST',
        body: {
          taskId: `T${taskId}`,
          priority: newPriorityValue,
        },
      });

      const priorityOption = PRIORITY_OPTIONS[newPriorityValue] || { name: 'Unknown', color: 'grey' };
      toast.success(`优先级已更新为：${priorityOption.name}`);
      
      if (onPriorityChange) {
        onPriorityChange({
          value: parseInt(newPriorityValue),
          name: priorityOption.name,
          color: priorityOption.color,
        });
      }
    } catch (error: any) {
      toast.error(`更新优先级失败：${error.message || '未知错误'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const displayName = PRIORITY_LABELS[currentPriority.value.toString()] || currentPriority.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isUpdating}
          className={cn(
            "text-xs px-2 py-0.5 rounded whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            getPriorityColor(currentPriority.value),
            isUpdating && "opacity-50 cursor-not-allowed"
          )}
        >
          {isUpdating ? '...' : displayName}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="text-xs">切换任务优先级</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.entries(PRIORITY_OPTIONS).map(([value, option]) => (
          <DropdownMenuItem
            key={value}
            onClick={() => handlePriorityClick(value)}
            className={cn(
              "text-xs",
              value === currentPriority.value.toString() && "bg-accent/50"
            )}
          >
            <span className="flex-1">{option.name}</span>
            {value === currentPriority.value.toString() && (
              <Check className="ml-2 h-3 w-3" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
