import { ChevronRight, Plus, X, CornerDownRight } from 'lucide-react';
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
  const indent = level * 24;
  
  return (
    <div className="group/item">
      <div 
        className={cn(
          "flex items-start gap-2 text-sm rounded-md px-2 py-1.5 transition-all duration-200",
          "hover:bg-muted/60",
          task.completed && "opacity-60 grayscale-[0.5]"
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {/* Expand/Collapse Button */}
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
          {showExpandButton ? (
            <button
              className="h-5 w-5 flex items-center justify-center rounded-sm hover:bg-muted/80 text-muted-foreground/50 hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onExpand(task.id);
              }}
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  task.expanded && "rotate-90"
                )}
              />
            </button>
          ) : (
             level > 0 && <CornerDownRight className="h-3 w-3 text-border ml-1" />
          )}
        </div>
        
        {/* Checkbox */}
        <div 
          className="flex-shrink-0 pt-0.5 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id, e);
          }}
        >
           <Checkbox 
             checked={task.completed} 
             onCheckedChange={() => {}} // Handled by onClick wrapper to pass event
             className={cn(
               "h-4 w-4 transition-all duration-200 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary",
               task.completed && "opacity-80"
             )}
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
            "flex-1 min-w-0 text-left text-sm cursor-pointer hover:text-primary transition-colors leading-6 select-text",
            task.completed ? "text-muted-foreground line-through decoration-border" : "text-foreground/90 font-medium"
          )}
        >
          {task.title}
        </button>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 pl-2">
          {/* Add Sub-subtask Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded hover:bg-background hover:shadow-sm hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(task.id);
            }}
            title="添加子任务"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          
          {/* Delete Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded hover:bg-destructive/10 hover:text-destructive"
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
        <div className="animate-in slide-in-from-top-1 fade-in duration-200">
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
