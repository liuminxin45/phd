import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle, Filter, X, ArrowUpDown, TrendingUp, FolderKanban, Bell } from 'lucide-react';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { Skeleton } from '@/components/ui/Skeleton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dropdown } from '@/components/ui/dropdown';
import { api, Project, Task } from '@/lib/api';
import { useUser } from '@/contexts/UserContext';
import { getTaskStatusName, getTaskStatusColor, TASK_STATUS, TASK_STATUS_NAMES } from '@/lib/constants/taskStatus';
import { fetchAllPaginated } from '@/lib/utils/pagination';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { httpClient } from '@/lib/httpClient';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user } = useUser();
  // Toast is now imported from @/lib/toast
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);  // Store all tasks for statistics
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectProgress, setProjectProgress] = useState<Record<number, number>>({});
  
  // Separate loading states for progressive loading
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(true);
  
  // Stats values for animation
  const [statsReady, setStatsReady] = useState(false);
  
  // Task filter states - load from localStorage or default to 'open' (进行中)
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('taskStatusFilter') || TASK_STATUS.OPEN;
    }
    return TASK_STATUS.OPEN;
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Project sorting states
  const [showProjectSort, setShowProjectSort] = useState(false);
  const [projectSortOrder, setProjectSortOrder] = useState<'asc' | 'desc'>('desc'); // desc = high to low
  
  // Task detail modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Project detail modal state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Save filter to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskStatusFilter', statusFilter);
    }
  }, [statusFilter]);

  // Handle task click
  const handleTaskClick = async (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    // Update the task in the tasks list
    setTasks((prevTasks) =>
      prevTasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    // Update all tasks list as well
    setAllTasks((prevTasks) =>
      prevTasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    // Update selected task so reopening shows updated data
    setSelectedTask(updatedTask);
  };

  // Handle project click
  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setIsProjectModalOpen(true);
  };

  const handleCloseProjectModal = () => {
    setIsProjectModalOpen(false);
    setSelectedProject(null);
  };

  const handleTitleChange = async (newTitle: string) => {
    if (!selectedTask) return;

    try {
      await httpClient('/api/tasks/edit', {
        method: 'POST',
        body: {
          objectIdentifier: `T${selectedTask.id}`,
          transactions: [
            { type: 'title', value: newTitle }
          ]
        }
      });

      const updatedTask = {
        ...selectedTask,
        fields: {
          ...selectedTask.fields,
          name: newTitle
        }
      };
      handleTaskUpdate(updatedTask);
      toast.success('标题更新成功');
    } catch (error) {
      toast.error('更新标题失败');
      throw error;
    }
  };


  // Progressive data loading
  useEffect(() => {
    if (!user) return;

    // Load tasks
    async function loadTasks() {
      if (!user) return;
      try {
        const allTasksData = await fetchAllPaginated<Task>({
          endpoint: '/api/tasks',
          params: { assigned: user.phid },
          label: 'tasks',
        });
        
        setAllTasks(allTasksData);
        setTasks(allTasksData);
        setStatsReady(true);
      } catch (err) {
      } finally {
        setLoadingTasks(false);
      }
    }

    // Load projects
    async function loadProjects() {
      if (!user) return;
      try {
        const allProjects = await fetchAllPaginated<Project>({
          endpoint: '/api/projects',
          params: { members: user.phid, queryKey: 'active' },
          label: 'projects',
        });
        
        setProjects(allProjects);
        setLoadingProjects(false);

        // Load progress in background without blocking
        if (allProjects.length > 0) {
          const progressPromises = allProjects.map(async (project: Project) => {
            try {
              const progressData = await httpClient<any>(`/api/projects/${project.id}/progress`);
              return { projectId: project.id, progress: progressData.progressPercentage };
            } catch (error) {
              return { projectId: project.id, progress: 0 };
            }
          });

          const progressResults = await Promise.all(progressPromises);
          const progressMap: Record<number, number> = {};
          progressResults.forEach(({ projectId, progress }) => {
            progressMap[projectId] = progress;
          });
          setProjectProgress(progressMap);
          setLoadingProgress(false);
        } else {
          setLoadingProgress(false);
        }
      } catch (err) {
        setLoadingProjects(false);
        setLoadingProgress(false);
      }
    }

    // Load all data in parallel without blocking navigation
    void loadTasks();
    void loadProjects();
  }, [user]);

  // Open Tasks: notbegin + spite (未开始 + 暂停)
  const openTasks = allTasks.filter(t => 
    t.fields.status.value === TASK_STATUS.NOT_BEGIN || 
    t.fields.status.value === TASK_STATUS.SPITE
  ).length;
  
  // In Progress: open + wontfix (进行中 + 进行中(不加入统计))
  const inProgressTasks = allTasks.filter(t => 
    t.fields.status.value === TASK_STATUS.OPEN || 
    t.fields.status.value === TASK_STATUS.WONTFIX
  ).length;
  
  // Completed: excluded + invalid + resolved (已完成(不加入统计) + 删除/中止 + 已完成)
  const completedTasks = allTasks.filter(t => 
    t.fields.status.value === TASK_STATUS.EXCLUDED || 
    t.fields.status.value === TASK_STATUS.INVALID || 
    t.fields.status.value === TASK_STATUS.RESOLVED
  ).length;

  // Filter tasks based on selected filters
  const filteredTasks = tasks.filter(task => {
    // Status filter
    if (statusFilter !== 'all' && task.fields.status.value !== statusFilter) {
      return false;
    }
    
    return true;
  });

  // Get unique statuses from all tasks for filter dropdown
  const uniqueStatuses = Array.from(new Set(allTasks.map(t => t.fields.status.value)));

  // Sort projects by progress
  const sortedProjects = [...projects].sort((a, b) => {
    const progressA = projectProgress[a.id] ?? 0;
    const progressB = projectProgress[b.id] ?? 0;
    
    if (projectSortOrder === 'asc') {
      return progressA - progressB; // Low to high
    } else {
      return progressB - progressA; // High to low
    }
  });

  return (
    <div className="p-6 space-y-6 bg-background">

      <div className="grid grid-cols-2 gap-6">
        {/* My Tasks */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-neutral-900">My Tasks</h3>
            <Dropdown
              options={[
                { value: 'all', label: 'All Status' },
                ...uniqueStatuses.map(status => ({
                  value: status,
                  label: getTaskStatusName(status)
                }))
              ]}
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
              icon={Filter}
            />
          </div>
          <div className="divide-y divide-neutral-200 max-h-96 overflow-y-auto">
              {loadingTasks ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </>
              ) : filteredTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-neutral-500">No tasks found</p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="p-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-neutral-900 flex-1">{task.fields.name}</p>
                      <span className="text-xs text-neutral-500 whitespace-nowrap ml-4">
                        {getTaskStatusName(task.fields.status.value)}
                      </span>
                    </div>
                  </div>
                ))
              )}
          </div>
        </div>

        {/* My Projects */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-neutral-900">My Projects</h3>
            <Dropdown
              options={[
                { value: 'desc', label: 'High to Low' },
                { value: 'asc', label: 'Low to High' }
              ]}
              value={projectSortOrder}
              onValueChange={(value) => setProjectSortOrder(value as 'asc' | 'desc')}
              icon={ArrowUpDown}
            />
          </div>
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {loadingProjects ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="space-y-3 p-3 rounded-lg border">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  ))}
                </>
              ) : sortedProjects.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-neutral-500">No projects found</p>
                </div>
              ) : (
                sortedProjects.map((project) => {
                  const progress = projectProgress[project.id] ?? 0;
                  const displayProgress = loadingProgress ? 0 : progress;
                  return (
                    <div
                      key={project.id}
                      onClick={() => handleProjectClick(project)}
                      className="space-y-2 cursor-pointer hover:bg-neutral-50 -mx-4 px-4 py-2 rounded transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-900">{project.fields.name}</span>
                        <span className="text-sm text-neutral-500">Active</span>
                      </div>
                      <Progress value={displayProgress} className="h-2" />
                      <p className="text-xs text-neutral-500">
                        <AnimatedCounter value={displayProgress} duration={1000} />% complete
                      </p>
                    </div>
                  );
                })
              )}
          </div>
        </div>
      </div>

      {/* Recent Blog Posts */}
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
