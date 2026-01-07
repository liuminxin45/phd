import { useEffect, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { api, Task } from '@/lib/api';
import { getTaskStatusName, getTaskStatusColor, TASK_STATUS, TASK_STATUS_NAMES } from '@/lib/constants/taskStatus';
import { fetchAllPaginated } from '@/lib/utils/pagination';
import { TaskStatusBadge } from '@/components/ui/TaskStatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { httpClient } from '@/lib/httpClient';
import { toast } from '@/lib/toast';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tasksPageStatusFilter') || 'all';
    }
    return 'all';
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  // Toast is now imported from @/lib/toast

  // Save filter to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tasksPageStatusFilter', statusFilter);
    }
  }, [statusFilter]);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const allTasks = await fetchAllPaginated<Task>({
          endpoint: '/api/tasks',
          label: 'tasks',
          maxItems: 100,
        });
        setTasks(allTasks);
      } catch (err) {
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.fields.status.value !== statusFilter) return false;
    return true;
  });

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
    // Update selected task so reopening shows updated data
    setSelectedTask(updatedTask);
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
    } catch (error) {
      toast.error('更新标题失败');
      throw error;
    }
  };

  const uniqueStatuses = Array.from(new Set(tasks.map(t => t.fields.status.value)));

  if (loading) {
    return <div className="p-6">Loading tasks...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Filter */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            showFilters || statusFilter !== 'all'
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">筛选</span>
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-neutral-700 mb-1.5 block">状态</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  statusFilter !== 'all'
                    ? 'border-blue-500 bg-blue-50 text-blue-900 font-medium'
                    : 'border-neutral-300 bg-white'
                }`}
              >
                <option value="all">全部状态</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>
                    {getTaskStatusName(status)}
                  </option>
                ))}
              </select>
            </div>
            
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900"
              >
                <X className="h-3 w-3" />
                清除筛选
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="divide-y divide-neutral-200">
          {filteredTasks.map((task) => (
            <div key={task.id} className="p-4 hover:bg-neutral-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-neutral-500">T{task.id}</span>
                    {task.fields.points !== null && (
                      <span className="text-xs text-neutral-500">• {task.fields.points} pts</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleTaskClick(task)}
                    className="text-sm text-neutral-900 text-left hover:text-blue-600 transition-colors block w-full"
                  >
                    {task.fields.name}
                  </button>
                </div>
                <TaskStatusBadge
                  taskId={task.id}
                  currentStatus={task.fields.status.value}
                  onStatusChange={(newStatus) => {
                    setTasks((prevTasks) =>
                      prevTasks.map((t) =>
                        t.id === task.id
                          ? { ...t, fields: { ...t.fields, status: { ...t.fields.status, value: newStatus } } }
                          : t
                      )
                    );
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailDialog
        task={selectedTask}
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        onTaskUpdate={handleTaskUpdate}
      />
    </div>
  );
}
