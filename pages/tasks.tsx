import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Loader2, X, Archive, ArchiveRestore, User, Calendar, Flag, Briefcase, CheckSquare, Square } from 'lucide-react';
import { Task, Project } from '@/lib/api';
import { getTaskStatusName, TASK_STATUS } from '@/lib/constants/taskStatus';
import { TaskStatusBadge } from '@/components/ui/TaskStatusBadge';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { httpClient } from '@/lib/httpClient';
import { toast } from '@/lib/toast';
import { useUser } from '@/contexts/UserContext';
import { PeoplePicker } from '@/components/ui/people-picker';
import { Dropdown } from '@/components/ui/dropdown';
import { getCachedUsers, getCachedProjects } from '@/lib/conduitBatch';
import { appStorage } from '@/lib/appStorage';

interface Person {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
}

const PAGE_SIZE = 100;
const STORAGE_KEY_TASK_ARCHIVE_IDS = 'archive.tasks.ids.v1';
const LEGACY_ARCHIVED_TASKS_KEY = 'archivedTaskIds';

const DEFAULT_STATUS_FILTER = TASK_STATUS.OPEN;
const DEFAULT_DATE_FILTER = 'quarter';

// Get priority color class based on priority value
const getPriorityColor = (priority: number | undefined): string => {
  switch (priority) {
    case 100: return 'bg-pink-500';      // Unbreak Now
    case 90: return 'bg-red-500';        // Needs Triage
    case 80: return 'bg-orange-500';     // High
    case 50: return 'bg-yellow-400';     // Normal
    case 25: return 'bg-sky-400';        // Low
    case 0: return 'bg-neutral-300';     // Wishlist
    default: return 'bg-neutral-200';
  }
};

export default function TasksPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter states - single person only
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_STATUS_FILTER);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(DEFAULT_DATE_FILTER);
  
  // Projects for filter dropdown
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Pagination
  const [hasMore, setHasMore] = useState(false);
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  
  // Task detail modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // Archive state
  const [archivedTaskIds, setArchivedTaskIds] = useState<Set<number>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [removingTaskIds, setRemovingTaskIds] = useState<Set<number>>(new Set());

  // Batch selection
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  
  // User and project cache for task cards
  const [userCache, setUserCache] = useState<Record<string, { realName: string; userName: string }>>({});
  const [projectCache, setProjectCache] = useState<Record<string, { name: string; color: string }>>({});
  
  // Track if initial user has been set
  const [initialUserSet, setInitialUserSet] = useState(false);

  // Load archived task IDs from localStorage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await appStorage.get<number[]>(STORAGE_KEY_TASK_ARCHIVE_IDS);
      if (!cancelled && Array.isArray(stored)) {
        setArchivedTaskIds(new Set(stored));
        return;
      }

      if (typeof window === 'undefined') return;
      try {
        const legacyRaw = localStorage.getItem(LEGACY_ARCHIVED_TASKS_KEY);
        const legacy = legacyRaw ? (JSON.parse(legacyRaw) as number[]) : null;
        if (!cancelled && legacy && Array.isArray(legacy)) {
          setArchivedTaskIds(new Set(legacy));
          await appStorage.set(STORAGE_KEY_TASK_ARCHIVE_IDS, legacy);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist archive state (keep state updater pure)
  useEffect(() => {
    void appStorage.set(STORAGE_KEY_TASK_ARCHIVE_IDS, [...archivedTaskIds]);
  }, [archivedTaskIds]);

  // Initialize selected person with current user
  useEffect(() => {
    if (user && !initialUserSet) {
      setSelectedPerson({
        id: user.phid,
        name: user.realName || user.userName,
        username: user.userName,
        avatar: user.realName?.charAt(0) || user.userName?.charAt(0)
      });
      setInitialUserSet(true);
    }
  }, [user, initialUserSet]);

  // Fetch projects for selected person (not current user)
  useEffect(() => {
    if (!selectedPerson) {
      setProjects([]);
      return;
    }
    
    async function fetchProjects() {
      try {
        const response = await httpClient<{ data: Project[] }>(
          `/api/projects?members=${selectedPerson!.id}&queryKey=active&limit=100`
        );
        setProjects(response.data || []);
        // Reset project filter when person changes
        setProjectFilter('all');
      } catch (err) {
        setProjects([]);
      }
    }
    fetchProjects();
  }, [selectedPerson]);

  // Load user and project metadata for task cards
  const loadTaskMetadata = async (taskList: Task[]) => {
    // Collect all user PHIDs (owners)
    const userPHIDs = new Set<string>();
    const projectPHIDs = new Set<string>();
    
    taskList.forEach(task => {
      if (task.fields.ownerPHID) {
        userPHIDs.add(task.fields.ownerPHID);
      }
      // Collect project PHIDs from attachments
      const taskProjects = (task as any).attachments?.projects?.projectPHIDs || [];
      taskProjects.forEach((phid: string) => projectPHIDs.add(phid));
    });
    
    // Fetch users
    if (userPHIDs.size > 0) {
      try {
        const usersMap = await getCachedUsers(Array.from(userPHIDs));
        const newUserCache: Record<string, { realName: string; userName: string }> = { ...userCache };
        usersMap.forEach((userData, phid) => {
          if (userData) {
            newUserCache[phid] = {
              realName: userData.realName || userData.fields?.realName || '',
              userName: userData.userName || userData.fields?.username || ''
            };
          }
        });
        setUserCache(newUserCache);
      } catch (err) {
        // Silently fail
      }
    }
    
    // Fetch projects
    if (projectPHIDs.size > 0) {
      try {
        const projectsMap = await getCachedProjects(Array.from(projectPHIDs));
        const newProjectCache: Record<string, { name: string; color: string }> = { ...projectCache };
        projectsMap.forEach((project, phid) => {
          if (project) {
            newProjectCache[phid] = {
              name: project.fields?.name || project.name || '',
              color: project.fields?.color?.key || 'grey'
            };
          }
        });
        setProjectCache(newProjectCache);
      } catch (err) {
        // Silently fail
      }
    }
  };

  // Fetch tasks based on filters
  const fetchTasks = async (append: boolean = false) => {
    if (!user) return;
    
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      // Build query params
      const params: Record<string, string> = {
        limit: String(PAGE_SIZE),
      };
      
      // User filter - single person
      if (selectedPerson) {
        params.assigned = selectedPerson.id;
      }
      
      // Status filter
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      // Project filter
      if (projectFilter !== 'all') {
        params.projects = projectFilter;
      }
      
      // Date filter - calculate date range
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date | null = null;
        
        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        }
        
        if (startDate) {
          params.createdStart = String(Math.floor(startDate.getTime() / 1000));
        }
      }
      
      // Pagination cursor
      if (append && afterCursor) {
        params.after = afterCursor;
      }
      
      const response = await httpClient<{ data: Task[]; cursor?: { after?: string } }>(
        '/api/tasks',
        { params }
      );
      
      const taskList = response.data || [];
      const cursor = response.cursor?.after || null;
      
      if (append) {
        setTasks(prev => [...prev, ...taskList]);
      } else {
        setTasks(taskList);
      }
      
      setAfterCursor(cursor);
      setHasMore(!!cursor);
      
      // Load user and project cache for task cards
      await loadTaskMetadata(taskList);
    } catch (err) {
      // Handle error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fetch tasks when filters change
  useEffect(() => {
    if (!initialUserSet) return;
    
    setAfterCursor(null);
    fetchTasks(false);
  }, [selectedPerson, statusFilter, projectFilter, dateFilter, initialUserSet]);

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

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      fetchTasks(true);
    }
  };

  const pendingArchiveOps = useRef<Set<number>>(new Set());

  const closeAllPopovers = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('phabdash:close-popovers'));
  }, []);

  const scheduleListTransition = useCallback((taskId: number) => {
    setRemovingTaskIds(prev => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    setTimeout(() => {
      setRemovingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      pendingArchiveOps.current.delete(taskId);
    }, 180);
  }, []);

  const archiveTask = useCallback((taskId: number) => {
    if (pendingArchiveOps.current.has(taskId)) return;
    pendingArchiveOps.current.add(taskId);
    closeAllPopovers();
    scheduleListTransition(taskId);

    toast.success('已归档');

    setArchivedTaskIds(prev => {
      if (prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  }, [closeAllPopovers, scheduleListTransition]);

  const unarchiveTask = useCallback((taskId: number) => {
    if (pendingArchiveOps.current.has(taskId)) return;
    pendingArchiveOps.current.add(taskId);
    closeAllPopovers();
    scheduleListTransition(taskId);

    toast.success('已取消归档');

    setArchivedTaskIds(prev => {
      if (!prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }, [closeAllPopovers, scheduleListTransition]);

  const toggleTaskSelected = useCallback((taskId: number) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedTaskIds(() => {
      const next = new Set<number>();
      for (const t of tasks) {
        const isArchived = archivedTaskIds.has(t.id);
        const isRemoving = removingTaskIds.has(t.id);
        const isVisible = showArchived ? (isArchived || isRemoving) : (!isArchived || isRemoving);
        if (isVisible) next.add(t.id);
      }
      return next;
    });
  }, [tasks, archivedTaskIds, removingTaskIds, showArchived]);

  const bulkArchiveSelected = useCallback(() => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;

    closeAllPopovers();

    setRemovingTaskIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    setTimeout(() => {
      setRemovingTaskIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      ids.forEach(id => pendingArchiveOps.current.delete(id));
    }, 180);

    setArchivedTaskIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });

    toast.success(`已归档 ${ids.length} 个任务`);
    clearSelection();
  }, [selectedTaskIds, closeAllPopovers, clearSelection]);

  const bulkUnarchiveSelected = useCallback(() => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;

    closeAllPopovers();

    setRemovingTaskIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    setTimeout(() => {
      setRemovingTaskIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      ids.forEach(id => pendingArchiveOps.current.delete(id));
    }, 180);

    setArchivedTaskIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });

    toast.success(`已取消归档 ${ids.length} 个任务`);
    clearSelection();
  }, [selectedTaskIds, closeAllPopovers, clearSelection]);

  const visibleTaskCount = useMemo(() => {
    let count = 0;
    for (const t of tasks) {
      const isArchived = archivedTaskIds.has(t.id);
      const isRemoving = removingTaskIds.has(t.id);
      const isVisible = showArchived ? (isArchived || isRemoving) : (!isArchived || isRemoving);
      if (isVisible) count++;
    }
    return count;
  }, [tasks, archivedTaskIds, showArchived, removingTaskIds]);

  // Status options for dropdown
  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: TASK_STATUS.NOT_BEGIN, label: getTaskStatusName(TASK_STATUS.NOT_BEGIN) },
    { value: TASK_STATUS.OPEN, label: getTaskStatusName(TASK_STATUS.OPEN) },
    { value: TASK_STATUS.SPITE, label: getTaskStatusName(TASK_STATUS.SPITE) },
    { value: TASK_STATUS.RESOLVED, label: getTaskStatusName(TASK_STATUS.RESOLVED) },
    { value: TASK_STATUS.WONTFIX, label: getTaskStatusName(TASK_STATUS.WONTFIX) },
    { value: TASK_STATUS.INVALID, label: getTaskStatusName(TASK_STATUS.INVALID) },
    { value: TASK_STATUS.EXCLUDED, label: getTaskStatusName(TASK_STATUS.EXCLUDED) },
  ];

  // Date options for dropdown
  const dateOptions = [
    { value: 'all', label: '全部时间' },
    { value: 'today', label: '今天' },
    { value: 'week', label: '最近一周' },
    { value: 'month', label: '本月' },
    { value: 'quarter', label: '最近三个月' },
  ];

  // Project options for dropdown
  const projectOptions = [
    { value: 'all', label: '全部项目' },
    ...projects.map(p => ({ value: p.phid, label: p.fields.name }))
  ];

  // Check if any filter is active
  const hasActiveFilters = statusFilter !== DEFAULT_STATUS_FILTER || projectFilter !== 'all' || dateFilter !== DEFAULT_DATE_FILTER;

  const clearAllFilters = () => {
    setStatusFilter(DEFAULT_STATUS_FILTER);
    setProjectFilter('all');
    setDateFilter(DEFAULT_DATE_FILTER);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Filter Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Person Filter - Single Selection */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">负责人:</span>
            <PeoplePicker
              selected={selectedPerson ? [selectedPerson] : []}
              onAdd={(person) => setSelectedPerson(person)}
              onRemove={() => setSelectedPerson(null)}
              placeholder="选择人员..."
              className="min-w-[200px]"
              maxSelections={1}
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">状态:</span>
            <Dropdown
              options={statusOptions}
              value={statusFilter}
              onValueChange={setStatusFilter}
              className="min-w-[120px]"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">时间:</span>
            <Dropdown
              options={dateOptions}
              value={dateFilter}
              onValueChange={setDateFilter}
              className="min-w-[120px]"
            />
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">项目:</span>
            <Dropdown
              options={projectOptions}
              value={projectFilter}
              onValueChange={setProjectFilter}
              className="min-w-[150px]"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
              清除筛选
            </button>
          )}

          {/* Archive Toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-1 text-sm ml-auto ${
              showArchived ? 'text-amber-600' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Archive className="h-4 w-4" />
            {showArchived ? '显示活跃任务' : `已归档 (${archivedTaskIds.size})`}
          </button>

          {/* Batch Mode Toggle */}
          <button
            onClick={() => {
              setIsBatchMode(v => {
                const next = !v;
                if (!next) {
                  setSelectedTaskIds(new Set());
                }
                return next;
              });
            }}
            className={`flex items-center gap-1 text-sm ${
              isBatchMode ? 'text-blue-600' : 'text-neutral-500 hover:text-neutral-700'
            }`}
            title={isBatchMode ? '退出批量模式' : '批量操作'}
          >
            {isBatchMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            批量
          </button>
        </div>

        {isBatchMode && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-600">已选择 {selectedTaskIds.size} 项</span>
            <button
              onClick={selectAllVisible}
              className="px-3 py-1.5 text-sm bg-white border border-neutral-300 rounded hover:bg-neutral-50"
            >
              全选当前
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm bg-white border border-neutral-300 rounded hover:bg-neutral-50"
            >
              清空
            </button>
            {showArchived ? (
              <button
                onClick={bulkUnarchiveSelected}
                disabled={selectedTaskIds.size === 0}
                className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                批量取消归档
              </button>
            ) : (
              <button
                onClick={bulkArchiveSelected}
                disabled={selectedTaskIds.size === 0}
                className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                批量归档
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      )}

      {/* Tasks Grid */}
      {!loading && (
        <>
          {visibleTaskCount === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
              <p className="text-sm text-neutral-500">
                {showArchived ? '没有已归档的任务' : '没有找到任务'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tasks.map((task) => {
                const ownerName = task.fields.ownerPHID ? 
                  (userCache[task.fields.ownerPHID]?.realName || userCache[task.fields.ownerPHID]?.userName || '') : '';
                const taskProjects = (task as any).attachments?.projects?.projectPHIDs || [];
                const priorityColor = getPriorityColor(task.fields.priority?.value);
                const estimatedDays = (task.fields as any)['custom.tp-link.estimated-days'];
                const estimatedDate = (task.fields as any)['custom.tp-link.estimated-date-complete'];
                const isArchived = archivedTaskIds.has(task.id);
                const isRemoving = removingTaskIds.has(task.id);
                const isVisible = showArchived ? (isArchived || isRemoving) : (!isArchived || isRemoving);
                const isSelected = selectedTaskIds.has(task.id);
                
                return (
                <div 
                  key={task.phid || task.id}
                  className={`group bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-lg hover:border-neutral-300 transition-all duration-150 relative ${
                    !isVisible && !isRemoving ? 'hidden' : ''
                  } ${
                    isRemoving ? 'opacity-40 scale-[0.98]' : ''
                  }`}
                >
                  {isBatchMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTaskSelected(task.id);
                      }}
                      className={`absolute top-2 left-2 h-5 w-5 rounded border flex items-center justify-center bg-white ${
                        isSelected ? 'border-blue-600 text-blue-600' : 'border-neutral-300 text-neutral-300'
                      }`}
                      title={isSelected ? '取消选择' : '选择'}
                    >
                      {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  )}
                  {/* Priority indicator bar */}
                  {task.fields.priority?.value !== undefined && (
                    <div 
                      className={`absolute top-0 left-0 right-0 h-1 rounded-t-lg ${priorityColor}`}
                    />
                  )}
                  
                  {/* Task Header */}
                  <div className="flex items-center justify-between mb-2 mt-1">
                    <span className="text-xs font-mono text-neutral-400">T{task.id}</span>
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

                  {/* Task Title */}
                  <button
                    onClick={() => handleTaskClick(task)}
                    className="text-sm font-medium text-neutral-900 text-left hover:text-blue-600 transition-colors block w-full line-clamp-2 mb-3 min-h-[40px]"
                  >
                    {task.fields.name}
                  </button>

                  {/* Task Details - Always visible */}
                  <div className="space-y-2 text-xs">
                    {/* Owner */}
                    {ownerName && (
                      <div className="flex items-center gap-1.5 text-neutral-600">
                        <User className="h-3.5 w-3.5 text-neutral-400" />
                        <span className="truncate">{ownerName}</span>
                      </div>
                    )}
                    
                    {/* Projects - show first one */}
                    {taskProjects.length > 0 && projectCache[taskProjects[0]] && (
                      <div className="flex items-center gap-1.5 text-neutral-600">
                        <Briefcase className="h-3.5 w-3.5 text-neutral-400" />
                        <span className="truncate">{projectCache[taskProjects[0]]?.name}</span>
                        {taskProjects.length > 1 && (
                          <span className="text-neutral-400">+{taskProjects.length - 1}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Task Meta - Show on hover */}
                  <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      {/* Points */}
                      {task.fields.points !== null && task.fields.points > 0 && (
                        <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                          {task.fields.points} pts
                        </span>
                      )}
                      
                      {/* Estimated days */}
                      {estimatedDays && (
                        <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Calendar className="h-3 w-3" />
                          {estimatedDays}
                        </span>
                      )}
                      
                      {/* Due date */}
                      {estimatedDate && (
                        <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Flag className="h-3 w-3" />
                          {new Date(estimatedDate * 1000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    
                    {/* Archive/Unarchive Button - Show on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (showArchived) {
                          unarchiveTask(task.id);
                        } else {
                          archiveTask(task.id);
                        }
                      }}
                      className={`p-1 rounded hover:bg-neutral-100 transition-colors ${
                        showArchived ? 'text-amber-600' : 'text-neutral-400 hover:text-neutral-600'
                      }`}
                      disabled={isRemoving}
                      title={showArchived ? '取消归档' : '归档'}
                    >
                      {showArchived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* Load More */}
          {hasMore && !showArchived && (
            <div className="flex justify-center mt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                加载更多
              </button>
            </div>
          )}
        </>
      )}

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
