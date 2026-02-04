import { useState } from 'react';
import { Project, Task } from '@/lib/api';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { UnstandardWidget } from '@/components/dashboard/UnstandardWidget';
import { httpClient } from '@/lib/httpClient';
import { toast } from 'sonner';

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

      {/* Task Detail Modal */}
      <TaskDetailDialog
        task={selectedTask}
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        onTaskUpdate={handleTaskUpdate}
      />

      {/* Project Detail Modal */}
      {selectedProject && isProjectModalOpen && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          style={{ margin: 0, padding: 0 }}
          onClick={handleCloseProjectModal}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ProjectDetailPanel 
              project={selectedProject} 
              isModal={true}
              onClose={handleCloseProjectModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
