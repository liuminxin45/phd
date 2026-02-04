import { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Pin, Loader2 } from 'lucide-react';
import { usePinnedPanel, PinnedItem } from '@/contexts/PinnedPanelContext';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { httpClient } from '@/lib/httpClient';
import { Task, Project } from '@/lib/api';
import * as Dialog from '@radix-ui/react-dialog';

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
      case 'task': return 'bg-blue-500';
      case 'project': return 'bg-purple-500';
      case 'bookmark': return 'bg-amber-500';
      default: return 'bg-neutral-500';
    }
  };

  // Always render the panel structure, just with 0 width when collapsed
  // Webviews are always mounted to prevent refresh
  return (
    <div className="relative flex">
      {/* Toggle Button */}
      {pinnedItems.length > 0 && (
        <button
          onClick={togglePanel}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full z-10 bg-white border border-r-0 border-neutral-200 rounded-l-lg p-2 shadow-md hover:bg-neutral-50 transition-all"
          title={isPanelExpanded ? 'Collapse pinned panel' : 'Expand pinned panel'}
        >
          {isPanelExpanded ? (
            <ChevronRight className="h-4 w-4 text-neutral-600" />
          ) : (
            <div className="flex items-center gap-1">
              <Pin className="h-4 w-4 text-neutral-600" />
              <span className="text-xs font-medium text-neutral-600">{pinnedItems.length}</span>
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </div>
          )}
        </button>
      )}

      <aside
        className={`bg-neutral-100 border-l border-neutral-200 flex flex-col transition-all duration-300 ${
          isPanelExpanded ? 'w-80' : 'w-0 overflow-hidden'
        }`}
      >
        <div className="h-10 flex items-center justify-between px-3 border-b border-neutral-200 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-neutral-600" />
            <span className="text-sm font-semibold text-neutral-900">Pinned</span>
            <span className="text-xs text-neutral-500">({pinnedItems.length})</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {pinnedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400 p-4">
              <Pin className="h-8 w-8 mb-2" />
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
                  className={`rounded-lg overflow-hidden border-2 shadow-sm bg-white cursor-pointer transition-all ${
                    isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-neutral-300 hover:border-blue-300'
                  }`}
                  onClick={() => handleItemClick(item)}
                >
                  <div 
                    className={`flex items-center justify-between px-3 py-2 select-none transition-colors ${getTypeColor(item.type)} hover:opacity-90`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 text-white flex-shrink-0 animate-spin" />
                      ) : null}
                      <span className="text-xs font-semibold text-white uppercase">
                        {item.type}
                      </span>
                      <span className="text-xs text-white/90 truncate" title={item.title}>
                        {item.title}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePinnedItem(item.id);
                        if (selectedItem?.id === item.id) {
                          setSelectedItem(null);
                          setTaskData(null);
                          setProjectData(null);
                        }
                      }}
                      className="p-1 hover:bg-white/20 rounded transition-colors flex-shrink-0"
                      title="Unpin"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
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
        <Dialog.Root
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedItem(null);
              setProjectData(null);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[9000]" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9001]">
              <ProjectDetailPanel
                project={projectData}
                isModal={true}
                onClose={() => {
                  setSelectedItem(null);
                  setProjectData(null);
                }}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
