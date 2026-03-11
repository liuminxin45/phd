import { useState } from 'react';
import { Project, Task } from '@/lib/api';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { UnstandardWidget } from '@/components/dashboard/UnstandardWidget';
import { DinnerWidget } from '@/components/dashboard/DinnerWidget';
import { ContactsWidget } from '@/components/dashboard/ContactsWidget';
import { httpClient } from '@/lib/httpClient';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { GlassPage, GlassPanel, GlassSection, glassPanelStrongClass } from '@/components/ui/glass';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <GlassPage showOrbs={false} className="min-h-full">
      <div className="h-full overflow-auto">
      <div className="relative z-10 mx-auto max-w-6xl space-y-5 p-5">
        <GlassPanel className={cn(glassPanelStrongClass, 'rounded-3xl p-4 md:p-5')}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/55 bg-white/52 shadow-[0_12px_28px_rgba(37,99,235,0.14)] backdrop-blur-lg">
              <LayoutGrid className="h-4.5 w-4.5 text-sky-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">Dashboard</h1>
            </div>
          </div>
        </GlassPanel>

        <GlassSection className="space-y-5">
        {/* Unstandard Items */}
        <UnstandardWidget
          onTaskClick={handleUnstandardTaskClick}
          onProjectClick={handleUnstandardProjectClick}
        />

        {/* Dinner Subsidy */}
        <DinnerWidget />

        {/* Contacts */}
        <ContactsWidget />
        </GlassSection>

        {/* Task Detail Modal */}
        <TaskDetailDialog
          task={selectedTask}
          open={isTaskModalOpen}
          onOpenChange={setIsTaskModalOpen}
          onTaskUpdate={handleTaskUpdate}
        />

        {/* Project Detail Modal */}
        <Dialog open={!!selectedProject && isProjectModalOpen} onOpenChange={(open) => !open && handleCloseProjectModal()}>
          <DialogContent showCloseButton={false} className="max-w-[calc(100%-2rem)] sm:max-w-5xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
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
      </div>
    </GlassPage>
  );
}
