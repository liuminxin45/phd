import { ChevronRight, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { Subtask } from '@/lib/task/types';

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
  const hasActualChildren = task.children && task.children.length > 0;
  const hasUnloadedChildren = task.hasChildren === true && (!task.children || task.children.length === 0);
  const showExpandButton = hasActualChildren || hasUnloadedChildren;
  const indent = level * 20;
  
  return (
    <div>
      <div 
        className={cn(
          "flex items-center gap-2 text-sm group rounded px-2 py-1.5 my-0.5 transition-colors hover:bg-muted/50",
          task.completed && "opacity-60"
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {/* Expand/Collapse Button */}
        <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {showExpandButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onExpand(task.id);
              }}
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform duration-200",
                  task.expanded && "rotate-90"
                )}
              />
            </Button>
          )}
        </div>
        
        {/* Checkbox - using generic div wrapper to capture click event properly if Checkbox swallows it */}
        <div 
          className="flex-shrink-0 pt-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id, e);
          }}
        >
           <Checkbox 
             checked={task.completed} 
             onCheckedChange={() => {}} // Handled by onClick wrapper to pass event
             className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
           />
        </div>
        
        {/* Task Title - Clickable */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onClick) {
              onClick(task);
            }
          }}
          className={cn(
            "flex-1 min-w-0 text-left text-sm cursor-pointer hover:underline underline-offset-2 break-words",
            task.completed ? "text-muted-foreground line-through" : "text-foreground"
          )}
        >
          {task.title}
        </button>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Add Sub-subtask Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0 hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(task.id);
            }}
            title="添加子任务"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          
          {/* Delete Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            title="删除子任务"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Render Children */}
      {hasActualChildren && task.expanded && (
        <div className="mt-0.5 space-y-0.5 animate-in slide-in-from-top-1 fade-in">
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
