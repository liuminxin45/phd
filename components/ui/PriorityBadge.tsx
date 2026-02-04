import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { httpClient } from '@/lib/httpClient';

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
  '100': { key: '100', name: 'P1', color: 'pink' },
  '90': { key: '90', name: 'P2', color: 'violet' },
  '80': { key: '80', name: 'P3', color: 'red' },
  '25': { key: '25', name: 'P5', color: 'yellow' },
  '0': { key: '0', name: 'P6', color: 'sky' },
};

function getPriorityColor(value: number): string {
  if (value >= 100) return 'bg-pink-100 text-pink-700';
  if (value >= 90) return 'bg-violet-100 text-violet-700';
  if (value >= 80) return 'bg-red-100 text-red-700';
  if (value >= 25) return 'bg-yellow-100 text-yellow-700';
  return 'bg-sky-100 text-sky-700';
}

export function PriorityBadge({ taskId, currentPriority, onPriorityChange }: PriorityBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Toast is now imported from @/lib/toast

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handlePriorityClick = async (newPriorityValue: string) => {
    if (newPriorityValue === currentPriority.value.toString() || isUpdating) return;

    setIsUpdating(true);
    setIsOpen(false);

    try {
      await httpClient('/api/tasks/update', {
        method: 'POST',
        body: {
          taskId: `T${taskId}`,
          priority: newPriorityValue,
        },
      });

      const priorityOption = PRIORITY_OPTIONS[newPriorityValue];
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={`text-xs px-2 py-0.5 rounded whitespace-nowrap transition-all ${getPriorityColor(currentPriority.value)} ${
          isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'
        }`}
      >
        {isUpdating ? '更新中...' : currentPriority.name}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-neutral-200">
            <p className="text-xs font-medium text-neutral-700">切换任务优先级</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(PRIORITY_OPTIONS).map(([value, option]) => (
              <button
                key={value}
                onClick={() => handlePriorityClick(value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors flex items-center justify-between ${
                  value === currentPriority.value.toString() ? 'bg-neutral-100' : ''
                }`}
              >
                <span className="text-neutral-900">{option.name}</span>
                {value === currentPriority.value.toString() && (
                  <span className="text-xs text-neutral-500">当前</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
