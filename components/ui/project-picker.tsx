import { useState } from 'react';
import { Search, X, Briefcase, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import * as Popover from '@radix-ui/react-popover';

interface Project {
  id: string;
  name: string;
  color?: string;
}

interface ProjectPickerProps {
  selected: Project[];
  onAdd: (project: Project) => void;
  onRemove: (projectId: string) => void;
  maxSelections?: number;
  dropdownZIndex?: number;
  className?: string;
}

// Mock project data (In a real app, this might come from an API or props)
const mockProjects: Project[] = [
  { id: '1', name: '工业维护Utility 1.5', color: 'blue' },
  { id: '2', name: '数据分析平台', color: 'green' },
  { id: '3', name: 'Neo Dashboard', color: 'purple' },
  { id: '4', name: '用户认证系统', color: 'orange' },
  { id: '5', name: 'API Gateway', color: 'red' },
  { id: '6', name: '监控系统', color: 'yellow' },
  { id: '7', name: '日志服务', color: 'pink' },
];

export function ProjectPicker({ selected, onAdd, onRemove, maxSelections, dropdownZIndex = 50, className }: ProjectPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredProjects = mockProjects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selected.some((s) => s.id === project.id)
  );

  const handleAddProject = (project: Project) => {
    if (maxSelections && selected.length >= maxSelections) {
      return;
    }
    onAdd(project);
    setSearchQuery('');
    setIsOpen(false);
  };

  const getColorClass = (color?: string) => {
    // Mapping internal color names to our new Badge variants or specific classes
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100/80',
      green: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100/80',
      purple: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100/80',
      orange: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100/80',
      red: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100/80',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100/80',
      pink: 'bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-100/80',
    };
    return colors[color || 'blue'] || colors.blue;
  };

  const canAddMore = !maxSelections || selected.length < maxSelections;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Selected Projects */}
      {selected.map((project) => (
        <Badge
          key={project.id}
          variant="outline"
          className={cn("gap-1 pr-1 font-normal", getColorClass(project.color))}
        >
          <Briefcase className="h-3 w-3 opacity-70" />
          <span>{project.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(project.id);
            }}
            className="ml-1 rounded-full p-0.5 hover:bg-black/10 transition-colors focus:outline-none"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Add Button with Popover */}
      {canAddMore && (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-input px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-accent-foreground/50 hover:text-accent-foreground hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Plus className="h-3 w-3" />
              添加项目
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2"
              style={{ zIndex: dropdownZIndex }}
              sideOffset={5}
              align="start"
            >
              {/* Search Input */}
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索项目..."
                  className="pl-8 h-8 text-xs"
                  autoFocus
                />
              </div>

              {/* Project List */}
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleAddProject(project)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer transition-colors focus:outline-none"
                    >
                      <div className={cn("h-5 w-5 rounded flex items-center justify-center shrink-0 text-[10px]", getColorClass(project.color))}>
                        <Briefcase className="h-3 w-3" />
                      </div>
                      <span className="truncate font-medium">{project.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    {searchQuery ? '未找到匹配的项目' : '没有可用项目'}
                  </div>
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
