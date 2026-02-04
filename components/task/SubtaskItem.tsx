import { CheckCircle, ChevronRight, Plus, X } from 'lucide-react';

interface Subtask {
  id: number;
  title: string;
  completed: boolean;
  expanded: boolean;
  children: Subtask[];
  hasChildren?: boolean;
  isLoadingChildren?: boolean;
}

interface SubtaskItemProps {
  task: Subtask;
  level?: number;
  onToggle: (taskId: number, event?: React.MouseEvent) => void;
  onExpand: (taskId: number) => void;
  onAddChild: (taskId: number) => void;
  onDelete: (taskId: number) => void;
  onClick?: (task: Subtask) => void;
}

export function SubtaskItem({ 
  task, 
  level = 0, 
  onToggle, 
  onExpand, 
  onAddChild, 
  onDelete, 
  onClick 
}: SubtaskItemProps) {
  // Only show expand button if:
  // 1. Task has actual loaded children, OR
  // 2. hasChildren is explicitly true AND children haven't been loaded yet (length === 0)
  // After loading, if children.length === 0 and hasChildren becomes false, don't show button
  const hasActualChildren = task.children && task.children.length > 0;
  const hasUnloadedChildren = task.hasChildren === true && (!task.children || task.children.length === 0);
  const showExpandButton = hasActualChildren || hasUnloadedChildren;
  const indent = level * 20;
  
  return (
    <div>
      <div 
        className="flex items-center gap-2 text-sm group hover:bg-neutral-50 rounded px-1 py-0.5 transition-colors" 
        style={{ paddingLeft: `${indent}px` }}
      >
        {/* Expand/Collapse Button */}
        {showExpandButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand(task.id);
            }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-neutral-100 rounded transition-colors"
          >
            <ChevronRight
              className={`h-3 w-3 text-neutral-500 transition-transform ${task.expanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
        {!showExpandButton && <span className="w-4" />}
        
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id, e);
          }}
          className="flex-shrink-0"
        >
          {task.completed ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <div className="h-4 w-4 border-2 border-neutral-300 rounded hover:border-neutral-400 transition-colors" />
          )}
        </button>
        
        {/* Task Title - Clickable */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onClick) {
              onClick(task);
            }
          }}
          className={`flex-1 text-left hover:underline cursor-pointer ${
            task.completed ? 'text-neutral-400 line-through' : 'text-neutral-900'
          }`}
        >
          {task.title}
        </button>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          {/* Add Sub-subtask Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(task.id);
            }}
            className="flex-shrink-0 p-1 hover:bg-neutral-100 rounded transition-opacity"
            title="添加子任务"
          >
            <Plus className="h-3 w-3 text-neutral-500" />
          </button>
          
          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="flex-shrink-0 p-1 hover:bg-red-100 rounded transition-opacity"
            title="删除子任务"
          >
            <X className="h-3 w-3 text-red-500" />
          </button>
        </div>
      </div>
      
      {/* Render Children */}
      {hasActualChildren && task.expanded && (
        <div className="mt-1 space-y-1">
          {task.children.map((child) => (
            <SubtaskItem
              key={child.id}
              task={child}
              level={level + 1}
              onToggle={onToggle}
              onExpand={onExpand}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
