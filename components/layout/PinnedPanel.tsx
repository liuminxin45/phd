import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Pin, Loader2, FolderKanban, ListTodo } from 'lucide-react';
import { usePinnedPanel, PinnedItem } from '@/contexts/PinnedPanelContext';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { httpClient } from '@/lib/httpClient';
import { Task, Project } from '@/lib/api';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { glassPanelClass, glassSectionClass, glassToolbarClass } from '@/components/ui/glass';

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
      return;
    }

    if (item.type === 'task') {
      loadTaskData(item);
      return;
    }
    if (item.type === 'project') {
      loadProjectData(item);
    }
  };

  const getTypeMeta = (item: PinnedItem) => {
    if (item.type === 'task') {
      return {
        label: 'Task',
        icon: <ListTodo className="h-3.5 w-3.5" />,
        badgeClass: 'border-sky-200/80 bg-sky-50/80 text-sky-700',
        idText: item.taskId ? `T${item.taskId}` : 'Task',
      };
    }
    if (item.type === 'project') {
      return {
        label: 'Project',
        icon: <FolderKanban className="h-3.5 w-3.5" />,
        badgeClass: 'border-violet-200/80 bg-violet-50/80 text-violet-700',
        idText: item.projectId ? `P${item.projectId}` : 'Project',
      };
    }
    return {
      label: item.type,
      icon: <Pin className="h-3.5 w-3.5" />,
      badgeClass: 'border-slate-200/80 bg-slate-50/80 text-slate-700',
      idText: item.id,
    };
  };

  return (
    <div className="relative flex h-full">
      {pinnedItems.length > 0 && (
        <Button
          onClick={togglePanel}
          variant="ghost"
          size="sm"
          className={cn(
            glassToolbarClass,
            'absolute left-0 top-1/2 z-20 h-10 -translate-x-full -translate-y-1/2 rounded-r-none border-r-0 px-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.14)]'
          )}
          title={isPanelExpanded ? 'Collapse pinned panel' : 'Expand pinned panel'}
        >
          {isPanelExpanded ? (
            <ChevronRight className="h-4 w-4 text-slate-700" />
          ) : (
            <div className="flex items-center gap-1.5">
              <Pin className="h-3.5 w-3.5 text-sky-700" />
              <span className="text-xs font-semibold text-slate-700">{pinnedItems.length}</span>
              <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
            </div>
          )}
        </Button>
      )}

      <aside
        className={cn(
          'overflow-hidden border-l border-white/60 bg-white/34 transition-all duration-300 backdrop-blur-xl supports-[backdrop-filter]:bg-white/24',
          isPanelExpanded ? 'w-80' : 'w-0'
        )}
      >
        <div className={cn(glassPanelClass, 'm-3 flex h-[calc(100%-1.5rem)] flex-col rounded-3xl border-white/60')}>
          <div className={cn(glassToolbarClass, 'mx-3 mt-3 flex h-10 shrink-0 items-center justify-between rounded-2xl border-white/58 px-3')}>
            <div className="flex items-center gap-2 text-slate-800">
              <Pin className="h-4 w-4 text-sky-700" />
              <span className="text-sm font-semibold">Pinned</span>
            </div>
            <Badge variant="outline" className="rounded-full border-white/60 bg-white/72 px-2 text-[11px] text-slate-600">
              {pinnedItems.length}
            </Badge>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {pinnedItems.length === 0 ? (
              <div className={cn(glassSectionClass, 'flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/55 bg-white/60 p-5 text-center')}>
                <Pin className="mb-2 h-7 w-7 text-slate-400" />
                <p className="text-sm font-medium text-slate-600">Nothing pinned yet</p>
                <p className="mt-1 text-xs text-slate-500">Pin a task or project to keep it here.</p>
              </div>
            ) : (
              pinnedItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const isLoading = (item.type === 'task' && loadingTaskId === item.taskId) ||
                  (item.type === 'project' && loadingProjectId === item.projectId);
                const meta = getTypeMeta(item);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      'glass-interactive group w-full rounded-2xl border p-3 text-left transition-all',
                      'bg-white/68 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52',
                      isSelected
                        ? 'border-sky-200/90 ring-1 ring-sky-200/65'
                        : 'border-white/58 hover:-translate-y-0.5 hover:border-sky-200/75 hover:bg-white/78'
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge variant="outline" className={cn('h-6 rounded-full border px-2 text-[11px] font-medium', meta.badgeClass)}>
                        <span className="mr-1">{meta.icon}</span>
                        {meta.label}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" /> : null}
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
                          className="h-6 w-6 rounded-lg text-slate-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                          title="Unpin"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900" title={item.title}>
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{meta.idText}</p>
                  </button>
                );
              })
            )}
          </div>
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
          <DialogContent showCloseButton={false} className="max-w-none w-auto h-auto p-0 bg-transparent border-0 shadow-none z-[9001]">
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
