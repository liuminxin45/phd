import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Loader2, Archive, ArchiveRestore, Calendar, Briefcase, CheckSquare, Square, Filter, X, ArrowUpDown, Plus, ClipboardList } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Person } from '@/lib/types';
import { getPriorityDotColor } from '@/lib/constants/priority';
import { Separator } from '@/components/ui/separator';
import { GlassIconButton, GlassPage, GlassPanel, GlassSection, glassPanelStrongClass, glassToolbarClass } from '@/components/ui/glass';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PAGE_SIZE = 100;
const STORAGE_KEY_TASK_ARCHIVE_IDS = 'archive.tasks.ids.v1';
const LEGACY_ARCHIVED_TASKS_KEY = 'archivedTaskIds';

const DEFAULT_STATUS_FILTER = TASK_STATUS.OPEN;
const DEFAULT_DATE_FILTER = 'quarter';
const DEFAULT_SCORE_FILTER = 'all';
const FILTER_TRIGGER_CLASS = 'h-8 gap-2 rounded-full border border-white/55 bg-white/68 px-3 text-xs shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52 hover:border-sky-200/80 hover:bg-white/78';

function isTaskScored(task: Task): boolean {
  const customFields = task.fields as any;
  const workClass = String(customFields?.['custom.tp-link.work-class'] || '').trim();
  const workScore = String(customFields?.['custom.tp-link.work-score'] || '').trim();

  const isValidWorkClass = !!workClass && workClass !== '0' && workClass !== '待定';
  const isValidWorkScore = !!workScore && workScore !== '待定';
  return isValidWorkClass && isValidWorkScore;
}

function getTaskProjectPHIDs(task: Task): string[] {
  const fromAttachments = (task as any).attachments?.projects?.projectPHIDs;
  if (Array.isArray(fromAttachments) && fromAttachments.length > 0) {
    return fromAttachments;
  }

  const fromFields = (task.fields as any)?.projectPHIDs;
  if (Array.isArray(fromFields) && fromFields.length > 0) {
    return fromFields;
  }

  return [];
}

export default function TasksPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_STATUS_FILTER);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(DEFAULT_DATE_FILTER);
  const [scoreFilter, setScoreFilter] = useState<string>(DEFAULT_SCORE_FILTER);
  const [sortOrder, setSortOrder] = useState<string>('priority');

  const [projects, setProjects] = useState<Project[]>([]);

  const [hasMore, setHasMore] = useState(false);
  const [afterCursor, setAfterCursor] = useState<string | null>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const [archivedTaskIds, setArchivedTaskIds] = useState<Set<number>>(new Set());
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [removingTaskIds, setRemovingTaskIds] = useState<Set<number>>(new Set());

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());

  const [userCache, setUserCache] = useState<Record<string, { realName: string; userName: string; image?: string }>>({});
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
      // Collect project PHIDs
      const taskProjects = getTaskProjectPHIDs(task);
      taskProjects.forEach((phid: string) => projectPHIDs.add(phid));
    });

    // Fetch users
    if (userPHIDs.size > 0) {
      try {
        const usersMap = await getCachedUsers(Array.from(userPHIDs));
        const newUserCache: Record<string, { realName: string; userName: string; image?: string }> = { ...userCache };
        usersMap.forEach((userData, phid) => {
          if (userData) {
            newUserCache[phid] = {
              realName: userData.realName || userData.fields?.realName || '',
              userName: userData.userName || userData.fields?.username || '',
              image: userData.image || userData.fields?.image || undefined
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
      await loadTaskMetadata(taskList, true);
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
  }, [selectedPerson, statusFilter, projectFilter, dateFilter, sortOrder, initialUserSet]);

  useEffect(() => {
    if (!archiveDialogOpen) return;
    const archivedVisibleTasks = tasks.filter((task) => archivedTaskIds.has(task.id));
    if (archivedVisibleTasks.length === 0) return;
    void loadTaskMetadata(archivedVisibleTasks, false);
  }, [archiveDialogOpen, tasks, archivedTaskIds]);

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
        const taskScored = isTaskScored(t);
        const matchesScore =
          scoreFilter === 'all' ||
          (scoreFilter === 'scored' && taskScored) ||
          (scoreFilter === 'unscored' && !taskScored);
        const isArchived = archivedTaskIds.has(t.id);
        const isRemoving = removingTaskIds.has(t.id);
        const isVisible = (!isArchived || isRemoving) && matchesScore;
        if (isVisible) next.add(t.id);
      }
      return next;
    });
  }, [tasks, archivedTaskIds, removingTaskIds, scoreFilter]);

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

  const visibleTaskCount = useMemo(() => {
    let count = 0;
    for (const t of tasks) {
      const taskScored = isTaskScored(t);
      const matchesScore =
        scoreFilter === 'all' ||
        (scoreFilter === 'scored' && taskScored) ||
        (scoreFilter === 'unscored' && !taskScored);
      const isArchived = archivedTaskIds.has(t.id);
      const isRemoving = removingTaskIds.has(t.id);
      const isVisible = (!isArchived || isRemoving) && matchesScore;
      if (isVisible) count++;
    }
    return count;
  }, [tasks, archivedTaskIds, removingTaskIds, scoreFilter]);

  const archivedTasks = useMemo(() => {
    const taskMap = new Map(tasks.map((task) => [task.id, task] as const));
    return Array.from(archivedTaskIds)
      .sort((a, b) => b - a)
      .map((taskId) => ({ taskId, task: taskMap.get(taskId) }));
  }, [tasks, archivedTaskIds]);

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

  // Score completion filter options
  const scoreOptions = [
    { value: 'all', label: '评分：全部' },
    { value: 'scored', label: '评分：已完成' },
    { value: 'unscored', label: '评分：未完成' },
  ];

  // Sort options
  const sortOptions = [
    { value: 'priority', label: '优先级' },
    { value: 'updated', label: '最近更新' },
    { value: 'created', label: '创建时间' },
    { value: 'title', label: '标题' },
  ];

  const hasActiveFilters = statusFilter !== DEFAULT_STATUS_FILTER || projectFilter !== 'all' || dateFilter !== DEFAULT_DATE_FILTER || scoreFilter !== DEFAULT_SCORE_FILTER;

  const clearAllFilters = () => {
    setStatusFilter(DEFAULT_STATUS_FILTER);
    setProjectFilter('all');
    setDateFilter(DEFAULT_DATE_FILTER);
    setScoreFilter(DEFAULT_SCORE_FILTER);
  };

  const archiveTask = useCallback((taskId: number) => {
    if (pendingArchiveOps.current.has(taskId)) return;
    pendingArchiveOps.current.add(taskId);
    closeAllPopovers();
    scheduleListTransition(taskId);
    setArchivedTaskIds((prev) => {
      if (prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    toast.success(`已归档任务 T${taskId}`);
  }, [closeAllPopovers, scheduleListTransition]);

  const unarchiveTask = useCallback((taskId: number) => {
    setArchivedTaskIds((prev) => {
      if (!prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    toast.success(`已从归档取出任务 T${taskId}`);
  }, []);

  return (
    <GlassPage showOrbs={false} className="h-full">
    <div className="h-full overflow-auto">
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col space-y-5 p-5">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0">
        <GlassPanel className={cn(glassPanelStrongClass, 'rounded-3xl p-5')}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/55 bg-white/52 shadow-[0_12px_28px_rgba(37,99,235,0.14)] backdrop-blur-lg">
              <ClipboardList className="h-4.5 w-4.5 text-sky-700" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Task Manager
            </h1>
            <Badge variant="secondary" className="px-2 py-0.5 text-xs font-normal text-muted-foreground bg-muted/50">
              {visibleTaskCount}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-[300px]">
              <QuickAddTask
                defaultOwner={selectedPerson}
                projects={projects}
                defaultProjectPHID={projectFilter}
                onTaskCreated={() => {
                  setAfterCursor(null);
                  fetchTasks(false);
                }}
                minimal
              />
            </div>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <GlassIconButton
              onClick={() => setArchiveDialogOpen(true)}
              className="relative"
              title="Archived Tasks"
              tone="warning"
              aria-label="Archived Tasks"
            >
              <Archive className="h-3.5 w-3.5" />
              {archivedTaskIds.size > 0 && (
                <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] leading-4 text-center">
                  {archivedTaskIds.size > 99 ? '∞' : archivedTaskIds.size}
                </span>
              )}
            </GlassIconButton>
          </div>
        </div>

        {/* ── Filter Bar ───────────────────────────────────────────────────── */}
        <div className={cn(glassToolbarClass, "flex flex-wrap lg:flex-nowrap items-center gap-2 rounded-2xl p-2.5 min-w-0")}>
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
          {/* Person Filter */}
          <PeoplePicker
            selected={selectedPerson ? [selectedPerson] : []}
            onAdd={(person) => setSelectedPerson(person)}
            onRemove={() => setSelectedPerson(null)}
            placeholder="负责人"
            className=""
            maxSelections={1}
            triggerClassName={cn(FILTER_TRIGGER_CLASS, "justify-start w-[108px] whitespace-nowrap text-slate-700")}
          />

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={cn(FILTER_TRIGGER_CLASS, "w-[108px] whitespace-nowrap")}>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Filter className="h-3 w-3" />
                <span className="text-foreground truncate max-w-[72px]">{statusOptions.find(o => o.value === statusFilter)?.label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Project Filter */}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className={cn(FILTER_TRIGGER_CLASS, "w-[116px] whitespace-nowrap")}>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                <span className="text-foreground max-w-[84px] truncate">{projectOptions.find(o => o.value === projectFilter)?.label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {projectOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className={cn(FILTER_TRIGGER_CLASS, "w-[108px] whitespace-nowrap")}>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="text-foreground truncate max-w-[72px]">{dateOptions.find(o => o.value === dateFilter)?.label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {dateOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Score completion filter */}
          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className={cn(FILTER_TRIGGER_CLASS, "w-[116px] whitespace-nowrap")}>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckSquare className="h-3 w-3" />
                <span className="text-foreground truncate max-w-[80px]">{scoreOptions.find(o => o.value === scoreFilter)?.label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {scoreOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

           {/* Sort */}
           <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className={cn(FILTER_TRIGGER_CLASS, "w-[108px] whitespace-nowrap")}>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowUpDown className="h-3 w-3" />
                <span className="text-foreground truncate max-w-[72px]">{sortOptions.find(o => o.value === sortOrder)?.label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 rounded-full border border-white/55 bg-white/68 px-2.5 text-xs text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52 hover:border-sky-200/80 hover:bg-white/78 whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              清除
            </Button>
          )}
          </div>

          <div className="flex items-center gap-2 min-w-0 lg:ml-auto whitespace-nowrap">
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
                className={cn(
                  "h-8 text-xs gap-1.5 rounded-full px-3 border border-white/55 bg-white/68 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52 hover:border-sky-200/80 hover:bg-white/78",
                  isBatchMode && "border-sky-200/90 bg-sky-50/82 text-sky-700"
                )}
              >
                {isBatchMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                批量操作
              </Button>

              {isBatchMode && (
                <div className="flex items-center gap-1 rounded-full border border-white/55 bg-white/66 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52 animate-in fade-in slide-in-from-right-2">
                  <span className="mx-2 text-xs text-slate-600">{selectedTaskIds.size} 选中</span>
                  <Button variant="ghost" size="sm" onClick={selectAllVisible} className="h-6 rounded-full px-2 text-[10px] text-slate-700 hover:bg-white/80">全选</Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-6 rounded-full px-2 text-[10px] text-slate-700 hover:bg-white/80">清空</Button>
                  <Separator orientation="vertical" className="h-4" />
                  <Button
                    size="sm"
                    onClick={bulkArchiveSelected}
                    disabled={selectedTaskIds.size === 0}
                    className="h-6 rounded-full border border-amber-300/70 bg-amber-500 px-3 text-[10px] text-white hover:bg-amber-600"
                  >
                    归档
                  </Button>
                </div>
              )}
          </div>
        </div>
        </GlassPanel>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <GlassSection className="flex-1 overflow-y-auto min-h-0 p-4 md:p-5">
        {loading ? (
           <div className="h-full flex items-center justify-center">
             <div className="flex flex-col items-center gap-3">
               <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
               <p className="text-sm text-muted-foreground/50">加载中...</p>
             </div>
           </div>
        ) : (
          <>
            {visibleTaskCount === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40">
                <CheckSquare className="h-16 w-16 mb-4 opacity-10" />
                <p className="text-lg font-medium text-foreground/50">
                  暂无任务
                </p>
                <p className="text-sm mt-1">
                  创建一个新任务开始工作
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {tasks.map((task) => {
                  const ownerName = task.fields.ownerPHID ?
                    (userCache[task.fields.ownerPHID]?.realName || userCache[task.fields.ownerPHID]?.userName || '') : '';
                  const ownerAvatar = task.fields.ownerPHID ? userCache[task.fields.ownerPHID]?.image : undefined;
                  const ownerFallback = ownerName ? ownerName.charAt(0) : 'U';

                  const taskProjects = getTaskProjectPHIDs(task);
                  const priorityDot = getPriorityDotColor(task.fields.priority?.value);
                  const estimatedDays = (task.fields as any)['custom.tp-link.estimated-days'];
                  const taskScored = isTaskScored(task);
                  const matchesScore =
                    scoreFilter === 'all' ||
                    (scoreFilter === 'scored' && taskScored) ||
                    (scoreFilter === 'unscored' && !taskScored);
                  const isArchived = archivedTaskIds.has(task.id);
                  const isRemoving = removingTaskIds.has(task.id);
                  const isVisible = (!isArchived || isRemoving) && matchesScore;
                  const isSelected = selectedTaskIds.has(task.id);

                  if (!isVisible && !isRemoving) return null;

                  return (
                    <div
                      key={task.phid || task.id}
                      onClick={() => handleTaskClick(task)}
                      className={cn(
                        "glass-interactive group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/62 bg-white/66 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/85 hover:bg-white/76",
                        "shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/54",
                        isRemoving && "opacity-0 scale-95 duration-500",
                        isSelected && "ring-2 ring-primary border-primary bg-primary/5"
                      )}
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                      {/* Batch Selection Overlay/Checkbox */}
                      {isBatchMode && (
                        <div
                          className="absolute top-3 right-3 z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => toggleTaskSelected(task.id)}
                            className={cn(
                              "h-5 w-5 rounded border bg-background flex items-center justify-center transition-colors shadow-sm",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/30 hover:border-primary/50 text-transparent"
                            )}
                          >
                            <CheckSquare className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="p-4 flex flex-col h-full gap-3">
                        {/* Header: ID + Priority + Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", priorityDot)} title="优先级" />
                            <span className="text-[10px] font-mono text-muted-foreground/60 tracking-tight">T{task.id}</span>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <TaskStatusBadge
                              taskId={task.id}
                              currentStatus={task.fields.status.value}
                              className="h-5 text-[10px] px-2 shadow-none"
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => archiveTask(task.id)}
                              className="h-6 w-6 rounded-md text-muted-foreground/70 opacity-0 transition-opacity hover:text-amber-700 hover:bg-amber-50 group-hover:opacity-100"
                              title="归档"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-medium leading-relaxed text-foreground/90 group-hover:text-primary transition-colors line-clamp-2 min-h-[2.5em]">
                          {task.fields.name}
                        </h3>

                        {/* Footer info */}
                        <div className="mt-auto pt-2 flex items-center justify-between">
                           {/* Project Tag (First one only) */}
                           <div className="flex items-center gap-1.5 overflow-hidden">
                              {taskProjects.length > 0 && projectCache[taskProjects[0]] ? (
                                <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px] font-normal bg-muted/50 text-muted-foreground truncate max-w-[100px] border-transparent">
                                  {projectCache[taskProjects[0]]?.name}
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/30 italic">No Project</span>
                              )}
                              {taskProjects.length > 1 && (
                                <span className="text-[10px] text-muted-foreground/50">+{taskProjects.length - 1}</span>
                              )}
                           </div>

                           {/* Meta: Avatar + Estimate */}
                           <div className="flex items-center gap-2 shrink-0">
                             {estimatedDays && (
                               <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/30 px-1 rounded">
                                 <Calendar className="h-3 w-3 opacity-70" />
                                 {String(estimatedDays).toLowerCase().endsWith('d') ? estimatedDays : `${estimatedDays}d`}
                               </span>
                             )}

                             {ownerName && (
                               <div className="flex items-center gap-1.5" title={ownerName}>
                                 <Avatar className="h-5 w-5 border border-background">
                                   <AvatarImage src={ownerAvatar} />
                                   <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{ownerFallback}</AvatarFallback>
                                 </Avatar>
                               </div>
                             )}
                           </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {hasMore && (
                  <div className="col-span-full flex justify-center py-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="gap-2 rounded-full px-6"
                    >
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {loadingMore ? '加载更多...' : '加载更多'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </GlassSection>

      {/* Task Detail Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className={cn("max-w-3xl rounded-3xl border border-white/70 bg-[#f8fbff]/92 p-5 shadow-[0_28px_66px_rgba(15,23,42,0.2)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78")}>
          <DialogHeader className="pb-1">
            <DialogTitle className="text-slate-900">Archived Tasks ({archivedTaskIds.size})</DialogTitle>
          </DialogHeader>
          {archivedTasks.length === 0 ? (
            <GlassSection className="glass-interactive border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No archived tasks.
            </GlassSection>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-2xl border border-white/70 bg-white/48 p-2.5 backdrop-blur-xl supports-[backdrop-filter]:bg-white/34">
              <div className="space-y-2.5 pr-1">
                {archivedTasks.map(({ taskId, task }) => {
                  const ownerName = task?.fields?.ownerPHID
                    ? (userCache[task.fields.ownerPHID]?.realName || userCache[task.fields.ownerPHID]?.userName || '未分配')
                    : '未分配';
                  return (
                    <div
                      key={`archived-task-${taskId}`}
                      className="glass-interactive flex items-center justify-between gap-3 rounded-2xl border border-white/58 bg-white/62 px-3.5 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {`T${taskId}`} · {task?.fields.name || `Task #${taskId}`}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          责任人：{ownerName}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unarchiveTask(taskId)}
                        className="h-8 rounded-xl border border-amber-200/80 bg-white/70 px-3 text-xs text-amber-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                      >
                        <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TaskDetailDialog
        task={selectedTask}
        open={isTaskModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseTaskModal();
        }}
        onTaskUpdate={handleTaskUpdate}
      />
    </div>
    </div>
    </GlassPage>
  );
}
