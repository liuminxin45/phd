import { useState } from 'react';
import { Project, Task } from '@/lib/api';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { UnstandardWidget } from '@/components/dashboard/UnstandardWidget';
import { DinnerWidget } from '@/components/dashboard/DinnerWidget';
import { httpClient } from '@/lib/httpClient';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function Dashboard() {
  // Task detail modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Project detail modal state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const handleTaskUpdate = (updatedTask: Task) => {
    setSelectedTask(updatedTask);
  };

  // Handle unstandard task click - fetch task by ID and open panel
  const handleUnstandardTaskClick = async (taskId: number) => {
    setSelectedTask(null);
    setIsTaskModalOpen(true);
    
    try {
      const response = await httpClient<{ data: Task[] }>('/api/tasks', {
        params: { ids: taskId },
      });
      if (response.data && response.data.length > 0) {
        setSelectedTask(response.data[0]);
      } else {
        setIsTaskModalOpen(false);
        toast.error('Task not found');
      }
    } catch (error) {
      setIsTaskModalOpen(false);
      toast.error('Failed to load task');
    }
  };

  // Handle unstandard project click - fetch project by ID and open panel
  const handleUnstandardProjectClick = async (projectId: number) => {
    try {
      const response = await httpClient<{ data: Project[] }>('/api/projects', {
        params: { ids: projectId },
      });
      if (response.data && response.data.length > 0) {
        setSelectedProject(response.data[0]);
        setIsProjectModalOpen(true);
      }
    } catch (error) {
      toast.error('Failed to load project');
    }
  };

  const handleCloseProjectModal = () => {
    setIsProjectModalOpen(false);
    setSelectedProject(null);
  };

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Unstandard Items */}
      <UnstandardWidget 
        onTaskClick={handleUnstandardTaskClick}
        onProjectClick={handleUnstandardProjectClick}
      />

      {/* Dinner Subsidy */}
      <DinnerWidget />

      {/* Task Detail Modal */}
      <TaskDetailDialog
        task={selectedTask}
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        onTaskUpdate={handleTaskUpdate}
      />

      {/* Project Detail Modal */}
      <Dialog open={!!selectedProject && isProjectModalOpen} onOpenChange={(open) => !open && handleCloseProjectModal()}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-5xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
          {selectedProject && (
            <ProjectDetailPanel 
              project={selectedProject} 
              isModal={true}
              onClose={handleCloseProjectModal}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
