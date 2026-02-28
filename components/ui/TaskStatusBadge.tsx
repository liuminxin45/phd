import { useState } from 'react';
import { getTaskStatusName, getTaskStatusColor, TASK_STATUS_NAMES } from '@/lib/constants/taskStatus';
import { toast } from 'sonner';
import { httpClient } from '@/lib/httpClient';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Check } from 'lucide-react';

interface TaskStatusBadgeProps {
  taskId: number;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  className?: string;
}

export function TaskStatusBadge({ taskId, currentStatus, onStatusChange, className }: TaskStatusBadgeProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusClick = async (newStatus: string) => {
    if (newStatus === currentStatus || isUpdating) return;

    setIsUpdating(true);

    try {
      await httpClient('/api/tasks/update', {
        method: 'POST',
        body: {
          taskId: `T${taskId}`,
          status: newStatus,
        },
      });

      toast.success(`任务状态已更新为：${getTaskStatusName(newStatus)}`);
      
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
    } catch (error: any) {
      toast.error(`更新任务状态失败：${error.message || '未知错误'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const colorClass = getTaskStatusColor(currentStatus);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isUpdating}
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            colorClass,
            isUpdating && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          {isUpdating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {isUpdating ? 'Updating...' : getTaskStatusName(currentStatus)}
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>切换状态</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {Object.entries(TASK_STATUS_NAMES).map(([statusValue, statusName]) => (
          <DropdownMenuItem
            key={statusValue}
            onClick={() => handleStatusClick(statusValue)}
            className={cn(
              statusValue === currentStatus && "bg-accent/50"
            )}
          >
            <span className="flex-1">{statusName}</span>
            {statusValue === currentStatus && (
              <Check className="ml-2 h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
