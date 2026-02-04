import { useState } from 'react';
import { CheckSquare, Square, Plus, X, Loader2, ListChecks, Trash2, ChevronRight, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { Task } from '@/lib/conduit/types';
import { httpClient } from '@/lib/httpClient';
import { toast } from '@/lib/toast';

interface SubtaskManagerProps {
  taskPHID: string;
  subtasks: Task[];
  onSubtasksUpdate: () => void;
  onSubtaskClick?: (subtask: Task) => void;
  parentProjectPHIDs?: string[];
}

export function SubtaskManager({ taskPHID, subtasks, onSubtasksUpdate, onSubtaskClick, parentProjectPHIDs = [] }: SubtaskManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [collapsedTasks, setCollapsedTasks] = useState<Set<number>>(new Set());
  const [addingChildFor, setAddingChildFor] = useState<number | null>(null);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dropTarget, setDropTarget] = useState<{ taskId: number; position: 'before' | 'after' | 'child' } | null>(null);
  const [showCompleted, setShowCompleted] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('subtask-show-completed');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  // Toast is now imported from @/lib/toast

  const toggleShowCompleted = () => {
    setShowCompleted(prev => {
      const newValue = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('subtask-show-completed', String(newValue));
      }
      return newValue;
    });
  };

  const handleCreateSubtask = async (parentPHID?: string) => {
    const title = parentPHID ? newChildTitle.trim() : newSubtaskTitle.trim();
    if (!title) {
      return;
    }

    setIsCreating(true);
    try {
      const taskIdMatch = title.match(/^T(\d+)$/i);
      const targetParentPHID = parentPHID || taskPHID;
      
      if (taskIdMatch) {
        // Input is a task ID (e.g., T12345), link existing task as subtask
        const taskId = `T${taskIdMatch[1]}`;
        await httpClient('/api/tasks/edit', {
          method: 'POST',
          body: {
            objectIdentifier: taskId,
            transactions: [
              { type: 'parents.add', value: [targetParentPHID] },
            ],
          },
        });
        toast.success('已关联现有任务为子任务');
      } else {
        // Input is a title, create new task with parent relationship
        const transactions: any[] = [
          { type: 'title', value: title },
          { type: 'parents.add', value: [targetParentPHID] },
          { type: 'status', value: 'notbegin' },
        ];
        
        // Auto-inherit parent task's project tags
        if (parentProjectPHIDs.length > 0) {
          transactions.push({ type: 'projects.set', value: parentProjectPHIDs });
        }
        
        await httpClient('/api/tasks/edit', {
          method: 'POST',
          body: { transactions },
        });
        toast.success('子任务已创建');
      }

      setNewSubtaskTitle('');
      setNewChildTitle('');
      setIsAdding(false);
      setAddingChildFor(null);
      onSubtasksUpdate();
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (subtask: Task, event: React.MouseEvent) => {
    const currentStatus = subtask.fields.status.value;
    
    // If reopening a completed task (either 'resolved' or 'excluded')
    if (currentStatus === 'resolved' || currentStatus === 'excluded') {
      setUpdatingTaskId(subtask.id);
      try {
        // Restore to 'wontfix' if it was 'excluded', otherwise restore to 'open'
        const newStatus = currentStatus === 'excluded' ? 'wontfix' : 'open';
        
        await httpClient('/api/tasks/edit', {
          method: 'POST',
          body: {
            objectIdentifier: `T${subtask.id}`,
            transactions: [
              { type: 'status', value: newStatus },
            ],
          },
        });
        toast.success('子任务已重新打开');
        onSubtasksUpdate();
      } catch (error) {
        toast.error('更新子任务状态失败');
      } finally {
        setUpdatingTaskId(null);
      }
      return;
    }
    
    // If completing a task, auto-determine status based on current status
    // If current status is 'wontfix' (进行中不加入统计), complete as 'excluded' (已完成不加入统计)
    // Otherwise, complete as 'resolved' (已完成)
    const statusValue = currentStatus === 'wontfix' ? 'excluded' : 'resolved';
    
    setUpdatingTaskId(subtask.id);
    try {
      await httpClient('/api/tasks/edit', {
        method: 'POST',
        body: {
          objectIdentifier: `T${subtask.id}`,
          transactions: [
            { type: 'status', value: statusValue },
          ],
        },
      });
      
      toast.success(
        statusValue === 'excluded' ? '子任务已完成（不加入统计）' : '子任务已完成'
      );
      
      await onSubtasksUpdate();
    } catch (error) {
      toast.error('更新子任务状态失败');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.phid);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, task: Task | null, position: 'before' | 'after' | 'child') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedTask) return;
    
    // Prevent dropping on itself or its descendants
    if (task && (task.id === draggedTask.id || isDescendant(draggedTask, task))) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    if (task) {
      setDropTarget({ taskId: task.id, position });
    } else {
      setDropTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetTask: Task | null, position: 'before' | 'after' | 'child') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedTask) return;
    
    setDropTarget(null);
    
    // Determine the new parent PHID
    let newParentPHID: string | null = null;
    
    if (!targetTask) {
      // Dropped at top level - make it a direct child of the main task
      newParentPHID = taskPHID;
    } else if (position === 'child') {
      // Dropped as a child of the target task
      newParentPHID = targetTask.phid;
    } else {
      // Dropped before/after - find the parent of the target task
      newParentPHID = findParentPHID(targetTask, subtasks) || taskPHID;
    }
    
    // If the parent hasn't changed, do nothing
    const currentParentPHID = findParentPHID(draggedTask, subtasks) || taskPHID;
    if (newParentPHID === currentParentPHID) {
      setDraggedTask(null);
      return;
    }
    
    try {
      // Remove from old parent and add to new parent
      const transactions: any[] = [];
      
      if (currentParentPHID) {
        transactions.push({ type: 'parents.remove', value: [currentParentPHID] });
      }
      
      if (newParentPHID) {
        transactions.push({ type: 'parents.add', value: [newParentPHID] });
      }
      
      await httpClient('/api/tasks/edit', {
        method: 'POST',
        body: {
          objectIdentifier: `T${draggedTask.id}`,
          transactions,
        },
      });
      
      toast.success('任务关系已更新');
      onSubtasksUpdate();
    } catch (error) {
      toast.error('更新任务关系失败');
    } finally {
      setDraggedTask(null);
    }
  };

  // Helper function to check if a task is a descendant of another
  const isDescendant = (ancestor: Task, potentialDescendant: Task): boolean => {
    if (!ancestor.subtasks) return false;
    
    for (const child of ancestor.subtasks) {
      if (child.id === potentialDescendant.id) return true;
      if (isDescendant(child, potentialDescendant)) return true;
    }
    
    return false;
  };

  // Helper function to find the parent PHID of a task
  const findParentPHID = (task: Task, tasks: Task[], parentPHID?: string): string | null => {
    for (const t of tasks) {
      if (t.id === task.id) {
        return parentPHID || null;
      }
      if (t.subtasks && t.subtasks.length > 0) {
        const found = findParentPHID(task, t.subtasks, t.phid);
        if (found !== null) return found;
      }
    }
    return null;
  };

  const handleDeleteSubtask = async (subtask: Task) => {
    const previousStatus = subtask.fields.status.value;
    
    setUpdatingTaskId(subtask.id);
    try {
      // Delete the subtask (set status to invalid)
      await httpClient('/api/tasks/edit', {
        method: 'POST',
        body: {
          objectIdentifier: `T${subtask.id}`,
          transactions: [
            { type: 'status', value: 'invalid' },
          ],
        },
      });

      // Refresh the list
      onSubtasksUpdate();

      // Show toast
      toast.success('子任务已删除');
      // Note: Undo functionality removed - Sonner doesn't support onUndo callback
    } catch (error) {
      toast.error('删除子任务失败');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Filter out deleted subtasks and count recursively
  const filterActiveSubtasks = (tasks: Task[]): Task[] => {
    return tasks.filter(st => st.fields.status.value !== 'invalid').map(st => ({
      ...st,
      subtasks: st.subtasks ? filterActiveSubtasks(st.subtasks) : []
    }));
  };

  const countSubtasksRecursive = (tasks: Task[]): { total: number; completed: number } => {
    let total = 0;
    let completed = 0;
    
    for (const task of tasks) {
      if (task.fields.status.value !== 'invalid') {
        total++;
        // Count both 'resolved' and 'excluded' as completed
        if (task.fields.status.value === 'resolved' || task.fields.status.value === 'excluded') {
          completed++;
        }
        if (task.subtasks && task.subtasks.length > 0) {
          const childCounts = countSubtasksRecursive(task.subtasks);
          total += childCounts.total;
          completed += childCounts.completed;
        }
      }
    }
    
    return { total, completed };
  };
  
  const activeSubtasks = filterActiveSubtasks(subtasks);
  const { total: totalCount, completed: completedCount } = countSubtasksRecursive(activeSubtasks);
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const toggleCollapse = (taskId: number) => {
    setCollapsedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const renderSubtask = (subtask: Task, depth: number = 0) => {
    const isCompleted = subtask.fields.status.value === 'resolved' || subtask.fields.status.value === 'excluded';
    const isUpdating = updatingTaskId === subtask.id;
    const hasChildren = subtask.subtasks && subtask.subtasks.length > 0;
    const isCollapsed = collapsedTasks.has(subtask.id);
    const isDragging = draggedTask?.id === subtask.id;
    const isDropTargetChild = dropTarget?.taskId === subtask.id && dropTarget.position === 'child';

    // Skip rendering if task is completed and showCompleted is false
    if (isCompleted && !showCompleted) {
      return null;
    }

    return (
      <div key={subtask.id}>
        {/* Drop zone above task */}
        <div
          className={`h-1 transition-all ${
            dropTarget?.taskId === subtask.id && dropTarget.position === 'before'
              ? 'bg-blue-500 h-2 my-1'
              : 'h-0'
          }`}
          onDragOver={(e) => handleDragOver(e, subtask, 'before')}
          onDrop={(e) => handleDrop(e, subtask, 'before')}
          style={{ marginLeft: `${depth * 24}px` }}
        />
        
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, subtask)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-2 p-2 rounded-md transition-colors group ${
            isDragging 
              ? 'opacity-50 bg-blue-100' 
              : isDropTargetChild
              ? 'bg-blue-100 ring-2 ring-blue-500'
              : 'bg-neutral-50 hover:bg-neutral-100'
          } cursor-move`}
          style={{ marginLeft: `${depth * 24}px` }}
          onDragOver={(e) => handleDragOver(e, subtask, 'child')}
          onDrop={(e) => handleDrop(e, subtask, 'child')}
        >
          {hasChildren && (
            <button
              onClick={() => toggleCollapse(subtask.id)}
              className="flex-shrink-0 text-neutral-600 hover:text-blue-600 transition-colors p-0.5"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-5" />}
          <button
            onClick={(e) => handleToggleStatus(subtask, e)}
            disabled={isUpdating}
            className="flex-shrink-0 text-neutral-600 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            {isUpdating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isCompleted ? (
              <CheckSquare className="h-5 w-5 text-green-600" />
            ) : (
              <Square className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => onSubtaskClick?.(subtask)}
            className={`flex-1 text-left text-sm hover:text-blue-600 transition-colors cursor-pointer ${
              isCompleted ? 'line-through text-neutral-500' : 'text-neutral-900'
            }`}
          >
            {subtask.fields.name}
            {hasChildren && subtask.subtasks && (
              <span className="ml-2 text-xs text-neutral-500">
                ({subtask.subtasks.filter((st: Task) => st.fields.status.value !== 'invalid').length})
              </span>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAddingChildFor(subtask.id);
              setNewChildTitle('');
            }}
            disabled={isUpdating}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1.5 rounded transition-all disabled:opacity-50"
            title="添加子任务"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteSubtask(subtask);
            }}
            disabled={isUpdating}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-all disabled:opacity-50"
            title="删除子任务"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        
        {/* Inline child task input */}
        {addingChildFor === subtask.id && (
          <div className="mt-1 ml-6 flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md" style={{ marginLeft: `${(depth + 1) * 24}px` }}>
            <input
              type="text"
              value={newChildTitle}
              onChange={(e) => setNewChildTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateSubtask(subtask.phid);
                } else if (e.key === 'Escape') {
                  setAddingChildFor(null);
                  setNewChildTitle('');
                }
              }}
              placeholder="输入子任务标题或任务ID (如 T12345)..."
              className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              disabled={isCreating}
            />
            <button
              onClick={() => handleCreateSubtask(subtask.phid)}
              disabled={isCreating || !newChildTitle.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>创建中...</span>
                </>
              ) : (
                <span>添加</span>
              )}
            </button>
            <button
              onClick={() => {
                setAddingChildFor(null);
                setNewChildTitle('');
              }}
              disabled={isCreating}
              className="p-1.5 text-neutral-600 hover:bg-neutral-200 rounded-md transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {hasChildren && !isCollapsed && subtask.subtasks && (
          <div className="mt-1 space-y-1">
            {subtask.subtasks
              .filter((st: Task) => st.fields.status.value !== 'invalid')
              .map((child: Task) => renderSubtask(child, depth + 1))}
            
            {/* Drop zone at the end of children list */}
            <div
              className={`h-1 transition-all ${
                dropTarget?.taskId === subtask.id && dropTarget.position === 'after'
                  ? 'bg-blue-500 h-2 my-1'
                  : 'h-0'
              }`}
              onDragOver={(e) => handleDragOver(e, subtask, 'after')}
              onDrop={(e) => handleDrop(e, subtask, 'after')}
              style={{ marginLeft: `${(depth + 1) * 24}px` }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-neutral-700" />
            <h3 className="text-sm font-semibold text-neutral-900">子任务</h3>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <span className="text-xs text-neutral-600">
                {completedCount}/{totalCount} ({completionPercentage}%)
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <button
              onClick={toggleShowCompleted}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
              title={showCompleted ? '隐藏已完成' : '显示已完成'}
            >
              {showCompleted ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>隐藏已完成</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  <span>显示已完成</span>
                </>
              )}
            </button>
          )}
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>添加子任务</span>
            </button>
          )}
        </div>
      </div>

      {/* Top-level drop zone */}
      <div
        className={`transition-all rounded-md ${
          dropTarget === null && draggedTask
            ? 'bg-blue-100 border-2 border-dashed border-blue-400 p-4 text-center text-sm text-blue-600'
            : 'h-0 overflow-hidden'
        }`}
        onDragOver={(e) => handleDragOver(e, null, 'child')}
        onDrop={(e) => handleDrop(e, null, 'child')}
      >
        拖到这里成为顶级子任务
      </div>

      {/* Subtask list */}
      {activeSubtasks.length > 0 && (
        <div className="space-y-1">
          {activeSubtasks.map((subtask) => renderSubtask(subtask, 0))}
        </div>
      )}

      {/* Add subtask form */}
      {isAdding && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateSubtask();
              } else if (e.key === 'Escape') {
                setIsAdding(false);
                setNewSubtaskTitle('');
              }
            }}
            placeholder="输入子任务标题或任务ID (如 T12345)..."
            className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            disabled={isCreating}
          />
          <button
            onClick={() => handleCreateSubtask()}
            disabled={isCreating || !newSubtaskTitle.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>创建中...</span>
              </>
            ) : (
              <span>添加</span>
            )}
          </button>
          <button
            onClick={() => {
              setIsAdding(false);
              setNewSubtaskTitle('');
            }}
            disabled={isCreating}
            className="p-1.5 text-neutral-600 hover:bg-neutral-200 rounded-md transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {subtasks.length === 0 && !isAdding && (
        <div className="text-center py-6 text-sm text-neutral-500">
          暂无子任务
        </div>
      )}
    </div>
  );
}
