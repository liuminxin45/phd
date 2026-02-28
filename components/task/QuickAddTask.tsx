import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Loader2, ChevronDown, ChevronUp, User, Briefcase, Flag, Send, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PeoplePicker } from '@/components/ui/people-picker';
import { cn } from '@/lib/utils';
import { httpClient } from '@/lib/httpClient';
import { toast } from '@/lib/toast';
import { Project } from '@/lib/api';
import { Person } from '@/lib/types';
import { PRIORITIES, getPriorityDotColor } from '@/lib/constants/priority';

interface QuickAddTaskProps {
  defaultOwner?: Person | null;
  projects: Project[];
  defaultProjectPHID?: string;
  onTaskCreated?: (taskData: any) => void;
  minimal?: boolean;
}

export function QuickAddTask({ defaultOwner, projects, defaultProjectPHID, onTaskCreated, minimal = false }: QuickAddTaskProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [owner, setOwner] = useState<Person | null>(null);
  const [description, setDescription] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOwner && !owner) {
      setOwner(defaultOwner);
    }
  }, [defaultOwner, owner]);

  useEffect(() => {
    if (defaultProjectPHID && defaultProjectPHID !== 'all') {
      setSelectedProject(defaultProjectPHID);
    }
  }, [defaultProjectPHID]);

  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setShowDescription(false);
  }, []);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      titleInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, any> = {
        title: trimmedTitle,
      };

      if (owner) {
        body.owner = owner.id;
      }

      if (priority) {
        body.priority = priority;
      }

      if (selectedProject && selectedProject !== 'none') {
        body.projects = [selectedProject];
      }

      if (description.trim()) {
        body.description = description.trim();
      }

      const result = await httpClient<{ object?: { id?: number; phid?: string } }>('/api/tasks/create', {
        method: 'POST',
        body,
      });

      const taskId = result?.object?.id;
      toast.success(taskId ? `任务 T${taskId} 已创建` : '任务已创建');

      onTaskCreated?.(result);
      resetForm();
      
      // If minimal, we might want to close after submit, or stay open? 
      // Let's keep it open for multiple entries, but focus input.
      titleInputRef.current?.focus();
    } catch (error: any) {
      console.error('Failed to create task:', error);
      toast.error('创建任务失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      if (title.trim() === '' && description.trim() === '') {
        setIsExpanded(false);
      } else {
        titleInputRef.current?.blur();
      }
    }
  };

  const handleCollapsedClick = () => {
    setIsExpanded(true);
  };

  // Collapsed state
  if (!isExpanded) {
    if (minimal) {
      return (
        <div
          onClick={handleCollapsedClick}
          className="group flex items-center gap-3 px-4 py-2 rounded-full border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-border/60 transition-all cursor-text text-muted-foreground hover:text-foreground/80 select-none"
        >
          <Plus className="h-4 w-4 opacity-50" />
          <span className="text-sm font-normal">快速添加任务...</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground opacity-50 font-mono">
            Click
          </kbd>
        </div>
      );
    }

    return (
      <Card
        className="shrink-0 rounded-lg shadow-sm border-dashed border-2 border-muted-foreground/20 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer group"
        onClick={handleCollapsedClick}
      >
        <div className="p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            快速新建任务...
          </span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            点击展开
          </kbd>
        </div>
      </Card>
    );
  }

  // Expanded state
  return (
    <div
      ref={formRef}
      className={cn(
        "relative group",
        minimal 
          ? "rounded-xl border bg-background shadow-lg shadow-black/5 animate-in fade-in-0 zoom-in-95 duration-200 z-50" 
          : "rounded-lg shadow-sm border-primary/30 animate-in fade-in-0 slide-in-from-top-1 duration-200 border"
      )}
      onKeyDown={handleKeyDown}
    >
      {minimal && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-2 top-2 h-6 w-6 rounded-full text-muted-foreground/50 hover:text-foreground"
          onClick={() => setIsExpanded(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}

      <div className={cn("p-4 space-y-3", minimal ? "p-3" : "")}>
        {/* Row 1: Title input + Submit button */}
        <div className="flex items-center gap-2">
          {!minimal && (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Plus className="h-4 w-4 text-primary" />
            </div>
          )}
          <Input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入任务标题..."
            className={cn(
              "flex-1 h-9 text-sm font-medium border-0 shadow-none focus-visible:ring-0 px-2 bg-transparent placeholder:text-muted-foreground/60",
              minimal && "h-8 text-sm"
            )}
            disabled={isSubmitting}
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className={cn("h-8 px-3 gap-1.5 rounded-full", minimal && "h-7 text-xs")}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            创建
          </Button>
        </div>

        {/* Row 2: Optional field selectors */}
        <div className={cn("flex flex-wrap items-center gap-2", minimal ? "pl-2" : "pl-10")}>
          {/* Priority */}
          <div className="flex items-center gap-1.5">
            <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
              <SelectTrigger className="w-auto min-w-[80px] h-7 text-xs border-dashed rounded-full px-2.5 bg-transparent hover:bg-muted/50">
                <SelectValue placeholder="优先级" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.key} value={p.key} className="text-xs">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", p.dotColor)} />
                      {p.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project */}
          {projects.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Select value={selectedProject} onValueChange={setSelectedProject} disabled={isSubmitting}>
                <SelectTrigger className="w-auto min-w-[100px] max-w-[150px] h-7 text-xs border-dashed rounded-full px-2.5 bg-transparent hover:bg-muted/50">
                   <div className="flex items-center gap-1.5 truncate">
                      <Briefcase className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate">{selectedProject && selectedProject !== 'none' ? projects.find(p => p.phid === selectedProject)?.fields.name : '选择项目'}</span>
                   </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">无项目</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.phid} value={p.phid} className="text-xs">
                      {p.fields.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Owner */}
          <div className="flex items-center gap-1.5">
            {owner ? (
              <Badge
                variant="secondary"
                className="h-7 gap-1 pr-1 pl-2 py-0.5 text-xs font-normal cursor-pointer hover:bg-secondary/80 rounded-full"
                onClick={() => setOwner(null)}
                title="点击移除负责人"
              >
                <User className="h-3 w-3 text-muted-foreground" />
                {owner.name}
                <button
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOwner(null);
                  }}
                >
                  <span className="sr-only">移除</span>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ) : (
              <PeoplePicker
                selected={[]}
                onAdd={(person) => setOwner(person)}
                onRemove={() => setOwner(null)}
                placeholder="负责人"
                className="w-auto"
                maxSelections={1}
                triggerClassName="rounded-full px-2.5 h-7 text-xs border-dashed bg-transparent hover:bg-muted/50"
              />
            )}
          </div>

          {/* Description Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 text-xs gap-1 text-muted-foreground hover:text-foreground rounded-full px-2", showDescription && "bg-muted/50 text-foreground")}
            onClick={() => setShowDescription(!showDescription)}
            type="button"
          >
            {showDescription ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            描述
          </Button>

          {/* Keyboard hints */}
          <div className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <span className="font-mono">Enter</span>
            <span>创建</span>
          </div>
        </div>

        {/* Description (collapsible) */}
        {showDescription && (
          <div className={cn("animate-in fade-in-0 slide-in-from-top-1 duration-150", minimal ? "pl-2" : "pl-10")}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加任务描述（支持 Remarkup 语法）..."
              className="min-h-[80px] text-xs resize-none border-dashed bg-muted/10 focus:bg-background transition-colors"
              disabled={isSubmitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
