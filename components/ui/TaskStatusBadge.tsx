import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getTaskStatusName, getTaskStatusColor, TASK_STATUS_NAMES } from '@/lib/constants/taskStatus';
import { toast } from '@/lib/toast';
import { httpClient } from '@/lib/httpClient';

interface TaskStatusBadgeProps {
  taskId: number;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

export function TaskStatusBadge({ taskId, currentStatus, onStatusChange }: TaskStatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCloseAll = () => {
      setIsOpen(false);
    };

    window.addEventListener('phabdash:close-popovers', handleCloseAll as any);
    return () => {
      window.removeEventListener('phabdash:close-popovers', handleCloseAll as any);
    };
  }, []);

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    // Close on scroll
    function handleScroll() {
      setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen]);

  const handleStatusClick = async (newStatus: string) => {
    if (newStatus === currentStatus || isUpdating) return;

    setIsUpdating(true);
    setIsOpen(false);

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

  const dropdownContent = isOpen && typeof document !== 'undefined' ? createPortal(
    <div 
      ref={dropdownRef}
      className="fixed w-48 bg-white border border-neutral-200 rounded-lg shadow-lg z-[9999] py-1"
      style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
    >
      <div className="px-3 py-2 border-b border-neutral-200">
        <p className="text-xs font-medium text-neutral-700">切换任务状态</p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {Object.entries(TASK_STATUS_NAMES).map(([statusValue, statusName]) => (
          <button
            key={statusValue}
            onClick={() => handleStatusClick(statusValue)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors flex items-center justify-between ${
              statusValue === currentStatus ? 'bg-neutral-100' : ''
            }`}
          >
            <span className="text-neutral-900">{statusName}</span>
            {statusValue === currentStatus && (
              <span className="text-xs text-neutral-500">当前</span>
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={`text-xs px-2 py-0.5 rounded whitespace-nowrap transition-all ${getTaskStatusColor(currentStatus)} ${
          isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'
        }`}
      >
        {isUpdating ? '更新中...' : getTaskStatusName(currentStatus)}
      </button>
      {dropdownContent}
    </div>
  );
}
