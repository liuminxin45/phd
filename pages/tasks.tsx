import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Loader2, Archive, ArchiveRestore, User, Calendar, Flag, Briefcase, CheckSquare, Square, Filter, X } from 'lucide-react';
import { Task, Project } from '@/lib/api';
import { getTaskStatusName, TASK_STATUS } from '@/lib/constants/taskStatus';
import { TaskStatusBadge } from '@/components/ui/TaskStatusBadge';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { QuickAddTask } from '@/components/task/QuickAddTask';
import { httpClient } from '@/lib/httpClient';
import { toast } from '@/lib/toast';
import { useUser } from '@/contexts/UserContext';
import { PeoplePicker } from '@/components/ui/people-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCachedUsers, getCachedProjects } from '@/lib/conduitBatch';
import { appStorage } from '@/lib/appStorage';
import { ANIMATION_DURATION } from '@/lib/constants/animation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Person } from '@/lib/types';
import { getPriorityLeftBorderColor, getPriorityHexColor } from '@/lib/constants/priority';

const PAGE_SIZE = 100;
const STORAGE_KEY_TASK_ARCHIVE_IDS = 'archive.tasks.ids.v1';
const LEGACY_ARCHIVED_TASKS_KEY = 'archivedTaskIds';

const DEFAULT_STATUS_FILTER = TASK_STATUS.OPEN;
const DEFAULT_DATE_FILTER = 'quarter';

export default function TasksPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_STATUS_FILTER);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(DEFAULT_DATE_FILTER);
  const [sortOrder, setSortOrder] = useState<string>('priority');
  
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [hasMore, setHasMore] = useState(false);
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  const [archivedTaskIds, setArchivedTaskIds] = useState<Set<number>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [removingTaskIds, setRemovingTaskIds] = useState<Set<number>>(new Set());

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  
  const [userCache, setUserCache] = useState<Record<string, { realName: string; userName: string }>>({});
  const [projectCache, setProjectCache] = useState<Record<string, { name: string; color: string }>>({});
  
  const [initialUserSet, setInitialUserSet] = useState(false);
  const [archiveStateLoaded, setArchiveStateLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await appStorage.get<number[]>(STORAGE_KEY_TASK_ARCHIVE_IDS);
      if (!cancelled && Array.isArray(stored)) {
        setArchivedTaskIds(new Set(stored));
        setArchiveStateLoaded(true);
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
      } catch {}
      if (!cancelled) {
        setArchiveStateLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (archiveStateLoaded) {
      void appStorage.set(STORAGE_KEY_TASK_ARCHIVE_IDS, [...archivedTaskIds]);
    }
  }, [archivedTaskIds, archiveStateLoaded]);

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

  const loadTaskMetadata = async (taskList: Task[], skipArchived: boolean = false) => {
    const userPHIDs = new Set<string>();
    const projectPHIDs = new Set<string>();
    
    taskList.forEach(task => {
      if (skipArchived && archivedTaskIds.has(task.id)) {
        return;
      }
      
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
        order: sortOrder,
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
      // Skip metadata loading for archived tasks when not in archived view
      await loadTaskMetadata(taskList, !showArchived);
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
  }, [selectedPerson, statusFilter, projectFilter, dateFilter, sortOrder, initialUserSet, showArchived]);
  
  // When switching to archived view, load metadata for archived tasks
  useEffect(() => {
    if (showArchived && tasks.length > 0) {
      const archivedTasks = tasks.filter(task => archivedTaskIds.has(task.id));
      if (archivedTasks.length > 0) {
        loadTaskMetadata(archivedTasks, false);
      }
    }
  }, [showArchived]);

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
    }, ANIMATION_DURATION.LIST_TRANSITION_MS);
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
    }, ANIMATION_DURATION.LIST_TRANSITION_MS);

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
    }, ANIMATION_DURATION.LIST_TRANSITION_MS);

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

  // Status options for select
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

  // Date options for select
  const dateOptions = [
    { value: 'all', label: '全部时间' },
    { value: 'today', label: '今天' },
    { value: 'week', label: '最近一周' },
    { value: 'month', label: '本月' },
    { value: 'quarter', label: '最近三个月' },
  ];

  // Project options for select
  const projectOptions = [
    { value: 'all', label: '全部项目' },
    ...projects.map(p => ({ value: p.phid, label: p.fields.name }))
  ];

  // Sort options
  const sortOptions = [
    { value: 'priority', label: '优先级' },
    { value: 'updated', label: '最近更新' },
    { value: 'created', label: '创建时间' },
    { value: 'title', label: '标题' },
  ];

  // Check if any filter is active
  const hasActiveFilters = statusFilter !== DEFAULT_STATUS_FILTER || projectFilter !== 'all' || dateFilter !== DEFAULT_DATE_FILTER;

  const clearAllFilters = () => {
    setStatusFilter(DEFAULT_STATUS_FILTER);
    setProjectFilter('all');
    setDateFilter(DEFAULT_DATE_FILTER);
  };

  return (
    <div className="p-6 space-y-6 h-full flex flex-col overflow-hidden">
      {/* Filter Toolbar */}
      <Card className="shrink-0 rounded-lg shadow-sm">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap shrink-0">
                <User className="h-3.5 w-3.5" />
                负责人
              </span>
              <PeoplePicker
                selected={selectedPerson ? [selectedPerson] : []}
                onAdd={(person) => setSelectedPerson(person)}
                onRemove={() => setSelectedPerson(null)}
                placeholder="选择人员..."
                className="w-[200px]"
                maxSelections={1}
              />
            </div>

            <div className="h-6 w-px bg-border hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap shrink-0">
                <Filter className="h-3.5 w-3.5" />
                状态
              </span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap shrink-0">
                <Calendar className="h-3.5 w-3.5" />
                时间
              </span>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="选择时间" />
                </SelectTrigger>
                <SelectContent>
                  {dateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap shrink-0">
                <Briefcase className="h-3.5 w-3.5" />
                项目
              </span>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="h-6 w-px bg-border hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap shrink-0">
                排序
              </span>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="ml-auto text-muted-foreground hover:text-foreground h-8"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                清除
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant={isBatchMode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setIsBatchMode(v => {
                    const next = !v;
                    if (!next) {
                      setSelectedTaskIds(new Set());
                    }
                    return next;
                  });
                }}
                className={cn("h-8 text-xs gap-1.5", isBatchMode && "text-primary")}
              >
                {isBatchMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                批量操作
              </Button>

              {isBatchMode && (
                <>
                  <span className="text-xs text-muted-foreground ml-2">已选 {selectedTaskIds.size} 项</span>
                  <Button variant="outline" size="sm" onClick={selectAllVisible} className="h-7 text-xs">全选</Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-xs">清空</Button>
                  {showArchived ? (
                    <Button 
                      size="sm" 
                      onClick={bulkUnarchiveSelected} 
                      disabled={selectedTaskIds.size === 0} 
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      取消归档
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={bulkArchiveSelected} 
                      disabled={selectedTaskIds.size === 0} 
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      归档
                    </Button>
                  )}
                </>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                "h-8 text-xs gap-1.5",
                showArchived ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-muted-foreground"
              )}
            >
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? '返回活跃任务' : `已归档 (${archivedTaskIds.size})`}
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Add Task */}
      {!showArchived && (
        <QuickAddTask
          defaultOwner={selectedPerson}
          projects={projects}
          defaultProjectPHID={projectFilter}
          onTaskCreated={() => {
            setAfterCursor(null);
            fetchTasks(false);
          }}
        />
      )}

      {/* Loading Spinner */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
        </div>
      )}

      {/* Tasks Grid */}
      {!loading && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          {visibleTaskCount === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
              <CheckSquare className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">
                {showArchived ? '没有已归档的任务' : '没有找到任务'}
              </p>
              <p className="text-sm mt-1">尝试调整筛选条件或添加新任务</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-4">
              {tasks.map((task) => {
                const ownerName = task.fields.ownerPHID ? 
                  (userCache[task.fields.ownerPHID]?.realName || userCache[task.fields.ownerPHID]?.userName || '') : '';
                const taskProjects = (task as any).attachments?.projects?.projectPHIDs || [];
                const priorityLeftBorder = getPriorityLeftBorderColor(task.fields.priority?.value);
                const priorityHexColor = getPriorityHexColor(task.fields.priority?.value);
                const estimatedDays = (task.fields as any)['custom.tp-link.estimated-days'];
                const estimatedDate = (task.fields as any)['custom.tp-link.estimated-date-complete'];
                const isArchived = archivedTaskIds.has(task.id);
                const isRemoving = removingTaskIds.has(task.id);
                const isVisible = showArchived ? (isArchived || isRemoving) : (!isArchived || isRemoving);
                const isSelected = selectedTaskIds.has(task.id);
                
                if (!isVisible && !isRemoving) return null;

                return (
                  <Card 
                    key={task.phid || task.id}
                    className={cn(
                      "group relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer border-l-4",
                      isRemoving && "opacity-40 scale-[0.98] pointer-events-none",
                      priorityLeftBorder // Keep class for Tailwind reference, but inline style ensures it works
                    )}
                    style={{ borderLeftColor: priorityHexColor }}
                    onClick={() => handleTaskClick(task)}
                  >
                    {isBatchMode && (
                      <div 
                        className="absolute top-2 left-2 z-10" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => toggleTaskSelected(task.id)}
                          className={cn(
                            "h-5 w-5 rounded border bg-background flex items-center justify-center transition-colors",
                            isSelected 
                              ? "border-primary bg-primary text-primary-foreground" 
                              : "border-muted-foreground/30 hover:border-primary/50"
                          )}
                        >
                          {isSelected && <CheckSquare className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}

                    <CardContent className="p-3 pl-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono text-muted-foreground/70">T{task.id}</span>
                        <div onClick={(e) => e.stopPropagation()}>
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

                      <h3 className="text-sm font-medium leading-snug mb-3 line-clamp-2 min-h-[2.5em] group-hover:text-primary transition-colors">
                        {task.fields.name}
                      </h3>

                      <div className="space-y-1.5">
                        {ownerName && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">{ownerName}</span>
                          </div>
                        )}
                        
                        {taskProjects.length > 0 && projectCache[taskProjects[0]] && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Briefcase className="h-3 w-3" />
                            <span className="truncate max-w-[100px]">{projectCache[taskProjects[0]]?.name}</span>
                            {taskProjects.length > 1 && (
                              <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] font-normal">
                                +{taskProjects.length - 1}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {task.fields.points !== null && task.fields.points > 0 && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium border-blue-200 text-blue-700 bg-blue-50">
                              {task.fields.points} pts
                            </Badge>
                          )}
                          
                          {(estimatedDays || estimatedDate) && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              {estimatedDays && (
                                <span className="flex items-center gap-0.5" title="Estimated Days">
                                  <Calendar className="h-3 w-3" />
                                  {estimatedDays}d
                                </span>
                              )}
                              {estimatedDate && (
                                <span className="flex items-center gap-0.5" title="Due Date">
                                  <Flag className="h-3 w-3" />
                                  {new Date(estimatedDate * 1000).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (showArchived) {
                              unarchiveTask(task.id);
                            } else {
                              archiveTask(task.id);
                            }
                          }}
                          className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted",
                            showArchived ? "text-amber-600" : "text-muted-foreground hover:text-foreground"
                          )}
                          title={showArchived ? '取消归档' : '归档'}
                        >
                          {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {hasMore && !showArchived && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full max-w-xs"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    加载中...
                  </>
                ) : (
                  '加载更多'
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={isTaskModalOpen}
          onOpenChange={(open) => {
            setIsTaskModalOpen(open);
            if (!open) {
              handleCloseTaskModal();
            }
          }}
          onTaskUpdate={handleTaskUpdate}
        />
      )}
    </div>
  );
}
