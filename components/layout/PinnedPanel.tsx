import { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Pin, Loader2 } from 'lucide-react';
import { usePinnedPanel, PinnedItem } from '@/contexts/PinnedPanelContext';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { httpClient } from '@/lib/httpClient';
import { Task, Project } from '@/lib/api';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function PinnedPanel() {
  const { pinnedItems, isPanelExpanded, togglePanel, removePinnedItem } = usePinnedPanel();
  const [selectedItem, setSelectedItem] = useState<PinnedItem | null>(null);
  const [taskData, setTaskData] = useState<Task | null>(null);
  const [projectData, setProjectData] = useState<Project | null>(null);
  const [loadingTaskId, setLoadingTaskId] = useState<number | null>(null);
  const [loadingProjectId, setLoadingProjectId] = useState<number | null>(null);

  const loadTaskData = async (item: PinnedItem) => {
    if (item.type !== 'task' || !item.taskId) return;
    
    setLoadingTaskId(item.taskId);
    try {
      const data = await httpClient<{ task: Task }>(`/api/tasks/${item.taskId}`);
      setTaskData(data.task);
      setProjectData(null);
      setSelectedItem(item);
    } catch (error) {
      console.error('Failed to load task:', error);
    } finally {
      setLoadingTaskId(null);
    }
  };

  const loadProjectData = async (item: PinnedItem) => {
    if (item.type !== 'project' || !item.projectId) return;
    
    setLoadingProjectId(item.projectId);
    try {
      const data = await httpClient<{ data: Project[] }>(`/api/projects/${item.projectId}`);
      if (data.data && data.data.length > 0) {
        setProjectData(data.data[0]);
        setTaskData(null);
        setSelectedItem(item);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleItemClick = (item: PinnedItem) => {
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
      setTaskData(null);
      setProjectData(null);
    } else {
      if (item.type === 'task') {
        loadTaskData(item);
      } else if (item.type === 'project') {
        loadProjectData(item);
      }
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'task': return 'bg-blue-500 border-blue-500';
      case 'project': return 'bg-purple-500 border-purple-500';
      case 'bookmark': return 'bg-orange-500 border-orange-500';
      default: return 'bg-muted border-muted-foreground';
    }
  };

  return (
    <div className="relative flex h-full">
      {/* Toggle Button */}
      {pinnedItems.length > 0 && (
        <Button
          onClick={togglePanel}
          variant="outline"
          size="sm"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full z-10 h-8 w-auto px-2 rounded-r-none border-r-0 shadow-md gap-1 bg-sidebar border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          title={isPanelExpanded ? 'Collapse pinned panel' : 'Expand pinned panel'}
        >
          {isPanelExpanded ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="flex items-center gap-1">
              <Pin className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{pinnedItems.length}</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </div>
          )}
        </Button>
      )}

      <aside
        className={cn(
          "flex flex-col border-l border-sidebar-border bg-sidebar transition-all duration-300",
          isPanelExpanded ? "w-80" : "w-0 overflow-hidden"
        )}
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-sidebar-border px-4 text-sidebar-foreground">
          <Pin className="h-4 w-4" />
          <span className="text-sm font-semibold">Pinned</span>
          <span className="text-xs text-muted-foreground">({pinnedItems.length})</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pinnedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <Pin className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm text-center">No pinned items</p>
              <p className="text-xs text-center mt-1">Pin tasks to keep them here</p>
            </div>
          ) : (
            pinnedItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const isLoading = (item.type === 'task' && loadingTaskId === item.taskId) || 
                                (item.type === 'project' && loadingProjectId === item.projectId);
              return (
                <div 
                  key={item.id} 
                  className={cn(
                    "group relative rounded-md border shadow-sm transition-all cursor-pointer overflow-hidden",
                    isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:shadow-md",
                    getTypeColor(item.type).replace('bg-', 'border-l-4 border-l-') // Use color for left border
                  )}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="bg-card p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase tracking-wider font-bold h-5">
                        {item.type}
                      </Badge>
                      {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-card-foreground line-clamp-2 leading-snug" title={item.title}>
                        {item.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePinnedItem(item.id);
                          if (selectedItem?.id === item.id) {
                            setSelectedItem(null);
                            setTaskData(null);
                            setProjectData(null);
                          }
                        }}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                        title="Unpin"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {selectedItem && selectedItem.type === 'task' && taskData && (
        <TaskDetailDialog
          task={taskData}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedItem(null);
              setTaskData(null);
            }
          }}
          onTaskUpdate={(updatedTask) => {
            setTaskData(updatedTask);
          }}
          overlayZIndex="z-[9000]"
          contentZIndex="z-[9000]"
        />
      )}

      {selectedItem && selectedItem.type === 'project' && projectData && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedItem(null);
              setProjectData(null);
            }
          }}
        >
          <DialogContent className="max-w-none w-auto h-auto p-0 bg-transparent border-0 shadow-none z-[9001]">
            <ProjectDetailPanel
              project={projectData}
              isModal={true}
              onClose={() => {
                setSelectedItem(null);
                setProjectData(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
