import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Loader2, Archive, ArchiveRestore, Calendar, Briefcase, CheckSquare, Square, Filter, X, ArrowUpDown, Plus, ClipboardList, FileDown, Sparkles, Timer } from 'lucide-react';
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
import { getServerLocalState, setServerLocalState } from '@/lib/localStateClient';
import { ANIMATION_DURATION } from '@/lib/constants/animation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Person } from '@/lib/types';
import { getPriorityDotColor } from '@/lib/constants/priority';
import { Separator } from '@/components/ui/separator';
import { GlassIconButton, GlassPage, GlassPanel, GlassSection, glassPanelStrongClass, glassToolbarClass } from '@/components/ui/glass';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent  } from "@/components/ui/calendar"; // 引入日历组件
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const PAGE_SIZE = 100;
const STORAGE_KEY_TASK_ARCHIVE_IDS = 'archive.tasks.ids.v1';
const LEGACY_ARCHIVED_TASKS_KEY = 'archivedTaskIds';
const SERVER_STORAGE_KEY_TASK_ARCHIVE_IDS = 'archive.tasks.ids.v2';

const DEFAULT_STATUS_FILTER = TASK_STATUS.OPEN;
const DEFAULT_DATE_FILTER = 'quarter';
const DEFAULT_SCORE_FILTER = 'all';
const FILTER_TRIGGER_CLASS = 'h-8 gap-2 rounded-full border border-white/55 bg-white/68 px-3 text-xs shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52 hover:border-sky-200/80 hover:bg-white/78';
const TASK_EXPORT_ACTIVE_JOB_KEY = 'tasks.export.activeJobId.v1';

type TaskExportScope = 'all' | 'year' | 'quarter';
type TaskExportJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

interface TaskExportState {
  jobId: string;
  scope: TaskExportScope;
  assigneePHID: string;
  assigneeName?: string;
  status: TaskExportJobStatus;
  stage: string;
  stageLabel: string;
  message: string;
  progressPercent: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
  options?: {
    includeTitle: boolean;
    includeDescription: boolean;
    descriptionUseLlm: boolean;
    includeComments: boolean;
    commentsUseLlm: boolean;
  };
  skippedTasks?: Array<{
    taskId: number;
    title: string;
    stage: string;
    reason: string;
  }>;
  failedTasks?: Array<{
    taskId: number;
    title: string;
    stage: string;
    reason: string;
  }>;
  etaSeconds?: number;
  error?: string;
  metrics: {
    totalTasks: number;
    fetchedTasks: number;
    commentsFetched: number;
    llmTotal: number;
    llmDone: number;
    llmFailed: number;
    skippedLlm: number;
    processedTasks: number;
  };
}

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
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set([DEFAULT_STATUS_FILTER]));
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

  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportScope, setExportScope] = useState<TaskExportScope>('all');
  const [exportStarting, setExportStarting] = useState(false);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportState, setExportState] = useState<TaskExportState | null>(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportIncludeTitle, setExportIncludeTitle] = useState(true);
  const [exportIncludeDescription, setExportIncludeDescription] = useState(true);
  const [exportDescriptionUseLlm, setExportDescriptionUseLlm] = useState(false);
  const [exportIncludeComments, setExportIncludeComments] = useState(true);
  const [exportCommentsUseLlm, setExportCommentsUseLlm] = useState(true);

  const toggleStatus = (value: string) => {
    setStatusFilters((prev) => {
      // 1. 复制当前的 Set
      const next = new Set(prev);

      // 2. 如果点击的是 "all"，则只保留 "all"
      if (value === 'all') {
        return new Set(['all']);
      }

      // 3. 如果之前选的是 "all"，现在选了具体状态，则移除 "all"
      if (next.has('all')) {
        next.delete('all');
      }

      // 4. 切换当前点击的状态
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }

      // 5. 如果移除后没有任何状态被选中，默认回退到 "all"
      if (next.size === 0) {
        return new Set(['all']);
      }

      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const serverStored = await getServerLocalState<number[]>(SERVER_STORAGE_KEY_TASK_ARCHIVE_IDS);
      if (!cancelled && Array.isArray(serverStored)) {
        setArchivedTaskIds(new Set(serverStored));
        await appStorage.set(STORAGE_KEY_TASK_ARCHIVE_IDS, serverStored);
        setArchiveStateLoaded(true);
        return;
      }

      const stored = await appStorage.get<number[]>(STORAGE_KEY_TASK_ARCHIVE_IDS);
      if (!cancelled && Array.isArray(stored)) {
        setArchivedTaskIds(new Set(stored));
        await setServerLocalState(SERVER_STORAGE_KEY_TASK_ARCHIVE_IDS, stored);
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
          await setServerLocalState(SERVER_STORAGE_KEY_TASK_ARCHIVE_IDS, legacy);
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
      const next = [...archivedTaskIds];
      void appStorage.set(STORAGE_KEY_TASK_ARCHIVE_IDS, next);
      void setServerLocalState(SERVER_STORAGE_KEY_TASK_ARCHIVE_IDS, next);
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

  const pollExportStatus = useCallback(async (jobId: string) => {
    try {
      const response = await httpClient<{ state: TaskExportState }>(`/api/tasks/export/status`, {
        params: { jobId },
      });
      setExportState(response.state || null);
      setExportJobId(jobId);
      setShowExportPanel(true);

      if (typeof window !== 'undefined') {
        localStorage.setItem(TASK_EXPORT_ACTIVE_JOB_KEY, jobId);
      }

      if (response.state?.status === 'done') {
        toast.success('任务导出已完成');
      } else if (response.state?.status === 'error') {
        toast.error(response.state.error || '任务导出失败');
      }
    } catch (error) {
      setExportState(null);
      setExportJobId(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TASK_EXPORT_ACTIVE_JOB_KEY);
      }
    }
  }, []);

  const startTaskExport = useCallback(async () => {
    if (!selectedPerson) {
      toast.error('请先选择责任人');
      return;
    }
    if (!exportIncludeTitle && !exportIncludeDescription && !exportIncludeComments) {
      toast.error('请至少选择一项导出内容');
      return;
    }

    setExportStarting(true);
    try {
      const body = {
        assigneePHID: selectedPerson.id,
        assigneeName: selectedPerson.name || selectedPerson.username || '',
        scope: exportScope,
        options: {
          includeTitle: exportIncludeTitle,
          includeDescription: exportIncludeDescription,
          descriptionUseLlm: exportIncludeDescription && exportDescriptionUseLlm,
          includeComments: exportIncludeComments,
          commentsUseLlm: exportIncludeComments && exportCommentsUseLlm,
        },
      };
      let response: { jobId: string; state: TaskExportState } | null = null;
      let lastError: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await httpClient<{ jobId: string; state: TaskExportState }>('/api/tasks/export/start', {
            method: 'POST',
            body,
          });
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }
      }
      if (!response) {
        throw lastError || new Error('导出启动失败');
      }
      const jobId = response.jobId;
      setExportDialogOpen(false);
      setExportJobId(jobId);
      setExportState(response.state || null);
      setShowExportPanel(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(TASK_EXPORT_ACTIVE_JOB_KEY, jobId);
      }
      toast.success('导出任务已启动');
    } catch (error: any) {
      toast.error(error?.message || '启动导出失败');
    } finally {
      setExportStarting(false);
    }
  }, [
    selectedPerson,
    exportScope,
    exportIncludeTitle,
    exportIncludeDescription,
    exportDescriptionUseLlm,
    exportIncludeComments,
    exportCommentsUseLlm,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedJobId = localStorage.getItem(TASK_EXPORT_ACTIVE_JOB_KEY);
    if (!savedJobId) return;
    void pollExportStatus(savedJobId);
  }, [pollExportStatus]);

  useEffect(() => {
    if (!exportJobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled) return;
      try {
        const response = await httpClient<{ state: TaskExportState }>(`/api/tasks/export/status`, {
          params: { jobId: exportJobId },
        });
        if (cancelled) return;
        const state = response.state || null;
        setExportState(state);

        const status = state?.status;
        if (status === 'done' || status === 'error' || status === 'cancelled') {
          if (status === 'done') {
            toast.success('任务导出完成，可下载结果');
          } else if (status === 'error') {
            toast.error(state?.error || '任务导出失败');
          }
          return;
        }
      } catch {
        // Keep polling to recover from transient failures.
      }
      timer = setTimeout(loop, 1000);
    };

    timer = setTimeout(loop, 300);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [exportJobId]);

  useEffect(() => {
    if (!exportJobId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void pollExportStatus(exportJobId);
      }
    };
    const onFocus = () => {
      void pollExportStatus(exportJobId);
    };
    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [exportJobId, pollExportStatus]);

  useEffect(() => {
    const status = exportState?.status;
    if (!status) return;
    if ((status === 'done' || status === 'error' || status === 'cancelled') && typeof window !== 'undefined') {
      localStorage.removeItem(TASK_EXPORT_ACTIVE_JOB_KEY);
    }
  }, [exportState?.status]);

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

      // [修改开始] Status filter
      if (!statusFilters.has('all') && statusFilters.size > 0) {
        params.status = Array.from(statusFilters).join(',');
      }
      // [修改结束]

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
          case 'custom':
            if (customDate) {
              startDate = customDate;
            }
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
  }, [selectedPerson, statusFilters, projectFilter, dateFilter, sortOrder, initialUserSet, customDate]);

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
    { value: 'custom', label: '自定义...' }, // 新增
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

  const hasActiveFilters = 
    (!statusFilters.has(DEFAULT_STATUS_FILTER) || statusFilters.size > 1) || // [修改]
    projectFilter !== 'all' || 
    dateFilter !== DEFAULT_DATE_FILTER || 
    scoreFilter !== DEFAULT_SCORE_FILTER;

  const clearAllFilters = () => {
    setStatusFilters(new Set([DEFAULT_STATUS_FILTER])); // [修改]
    setProjectFilter('all');
    setDateFilter(DEFAULT_DATE_FILTER);
    setScoreFilter(DEFAULT_SCORE_FILTER);
  };

  const formatEta = useCallback((seconds?: number) => {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '估算中';
    if (seconds < 60) return `${Math.max(1, Math.round(seconds))} 秒`;
    const minutes = Math.floor(seconds / 60);
    const remain = Math.floor(seconds % 60);
    if (minutes < 60) return `${minutes} 分 ${remain} 秒`;
    const hours = Math.floor(minutes / 60);
    return `${hours} 小时 ${minutes % 60} 分`;
  }, []);

  const triggerExportDownload = useCallback((format: 'json' | 'md') => {
    if (!exportJobId) return;
    if (typeof window === 'undefined') return;
    const url = `/api/tasks/export/download?jobId=${encodeURIComponent(exportJobId)}&format=${format}`;
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [exportJobId]);

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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!selectedPerson) {
                  toast.error('请先选择责任人');
                  return;
                }
                if (exportJobId && !showExportPanel) {
                  setShowExportPanel(true);
                  void pollExportStatus(exportJobId);
                  return;
                }
                setExportDialogOpen(true);
              }}
              disabled={!selectedPerson}
              className="h-8 gap-1.5 rounded-full border border-white/55 bg-white/68 px-3 text-xs text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52 hover:border-sky-200/80 hover:bg-white/78 disabled:opacity-50"
              title={selectedPerson ? '导出当前责任人历史任务' : '请先选择责任人'}
            >
              <FileDown className="h-3.5 w-3.5" />
              {exportJobId && !showExportPanel ? '查看导出' : '导出'}
            </Button>
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

          {/* Status Filter - Multi Select */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className={cn(FILTER_TRIGGER_CLASS, "w-[120px] justify-between px-3 font-normal")}
              >
                <div className="flex items-center gap-1.5 text-muted-foreground overflow-hidden">
                  <Filter className="h-3 w-3 shrink-0" />
                  <span className="text-foreground truncate text-xs">
                    {statusFilters.has('all') 
                      ? '全部状态'
                      : statusFilters.size === 1
                        ? statusOptions.find(o => o.value === Array.from(statusFilters)[0])?.label
                        : `已选 ${statusFilters.size} 项`
                    }
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="start">
              <DropdownMenuLabel className="text-xs">状态筛选</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={statusFilters.has('all')}
                onCheckedChange={() => setStatusFilters(new Set(['all']))}
                className="text-xs"
              >
                全部状态
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {statusOptions.filter(o => o.value !== 'all').map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={statusFilters.has(option.value)}
                  onCheckedChange={() => toggleStatus(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

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

          {/* Date Filter - Custom with Calendar */}
          <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                className={cn(FILTER_TRIGGER_CLASS, "w-[128px] justify-between px-3 font-normal")}
              >
                 <div className="flex items-center gap-1.5 text-muted-foreground overflow-hidden">
                  <Calendar className="h-3 w-3 shrink-0" /> {/* 这是 Lucide 图标 */}
                  <span className="text-foreground truncate text-xs">
                    {dateFilter === 'custom' && customDate 
                      ? format(customDate, 'yyyy/MM/dd', { locale: zhCN }) 
                      : dateOptions.find(o => o.value === dateFilter)?.label
                    }
                  </span>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {/* 预设选项列表 */}
              <div className="p-1">
                {dateOptions.filter(o => o.value !== 'custom').map(option => (
                  <div
                    key={option.value}
                    className={cn(
                      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      dateFilter === option.value && "bg-accent/50 text-accent-foreground font-medium"
                    )}
                    onClick={() => {
                      setDateFilter(option.value);
                      setIsDatePopoverOpen(false);
                    }}
                  >
                    {option.label}
                    {dateFilter === option.value && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-primary/50" />
                    )}
                  </div>
                ))}
              </div>
              
              <Separator />
              
              {/* 日历部分 */}
              <div className="p-3">
                <div className="mb-2 px-1 text-xs font-medium text-muted-foreground">自定义开始时间</div>
                <CalendarComponent
                  mode="single"
                  selected={customDate}
                  onSelect={(date) => {
                    if (date) {
                      setCustomDate(date);
                      setDateFilter('custom');
                      setIsDatePopoverOpen(false);
                    }
                  }}
                  initialFocus
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                />
              </div>
            </PopoverContent>
          </Popover>

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

      {showExportPanel && exportState && (
        <GlassSection className="rounded-2xl border border-white/60 bg-white/62 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <p className="text-sm font-semibold text-slate-900">
                  任务导出进度
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  {exportState.stageLabel || exportState.stage}
                </Badge>
              </div>
              <p className="text-xs text-slate-600">{exportState.message}</p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                {(exportState.stage === 'fetch_tasks' || exportState.stage === 'fetch_comments') ? (
                  <span>已拉取 {exportState.metrics.fetchedTasks} / 评论 {exportState.metrics.commentsFetched}</span>
                ) : (
                  <span>任务 {exportState.metrics.processedTasks}/{exportState.metrics.totalTasks || exportState.metrics.fetchedTasks}</span>
                )}
                <span>LLM 成功 {exportState.metrics.llmDone}</span>
                <span>失败 {exportState.failedTasks?.length || exportState.metrics.llmFailed}</span>
                <span>跳过 {exportState.skippedTasks?.length || exportState.metrics.skippedLlm}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {Math.max(0, Math.min(100, Math.round(exportState.progressPercent || 0)))}%
              </Badge>
              {(exportState.status === 'running' || exportState.status === 'queued') && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Timer className="h-3 w-3" />
                  预计剩余 {formatEta(exportState.etaSeconds)}
                </Badge>
              )}
              {exportState.status === 'done' && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => triggerExportDownload('json')}>
                    下载 JSON
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => triggerExportDownload('md')}>
                    下载 Markdown
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowExportPanel(false)}
              >
                收起
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Progress value={Math.max(0, Math.min(100, exportState.progressPercent || 0))} className="h-1.5" />
            {exportState.error && (
              <p className="text-xs text-red-600">{exportState.error}</p>
            )}
            {((exportState.failedTasks?.length || 0) > 0 || (exportState.skippedTasks?.length || 0) > 0) && (
              <div className="grid gap-2 pt-2 md:grid-cols-2">
                <div className="rounded-xl border border-red-200/70 bg-red-50/55 p-2.5">
                  <p className="text-xs font-semibold text-red-700">失败任务 ({exportState.failedTasks?.length || 0})</p>
                  <div className="mt-1.5 max-h-32 overflow-auto space-y-1.5 pr-1">
                    {(exportState.failedTasks || []).map((item) => (
                      <p key={`failed-${item.taskId}-${item.reason}`} className="text-[11px] text-red-700/90 leading-snug">
                        T{item.taskId} {item.title || ''}：{item.reason}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-2.5">
                  <p className="text-xs font-semibold text-amber-700">跳过任务 ({exportState.skippedTasks?.length || 0})</p>
                  <div className="mt-1.5 max-h-32 overflow-auto space-y-1.5 pr-1">
                    {(exportState.skippedTasks || []).map((item) => (
                      <p key={`skipped-${item.taskId}-${item.reason}`} className="text-[11px] text-amber-700/90 leading-snug">
                        T{item.taskId} {item.title || ''}：{item.reason}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassSection>
      )}

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

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className={cn("max-w-md rounded-3xl border border-white/70 bg-[#f8fbff]/92 p-5 shadow-[0_28px_66px_rgba(15,23,42,0.2)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78")}>
          <DialogHeader className="pb-1">
            <DialogTitle className="text-slate-900">导出责任人历史任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/65 bg-white/65 p-3 text-xs text-slate-600">
              <p>责任人：{selectedPerson?.name || selectedPerson?.username || '-'}</p>
              <p className="mt-1">时间基准：任务创建时间（dateCreated）</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">导出范围</label>
              <Select value={exportScope} onValueChange={(value) => setExportScope(value as TaskExportScope)}>
                <SelectTrigger className={cn(FILTER_TRIGGER_CLASS, "w-full justify-between px-3 font-normal")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">全部任务</SelectItem>
                  <SelectItem value="year" className="text-xs">按年分组</SelectItem>
                  <SelectItem value="quarter" className="text-xs">按季度分组</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-2xl border border-white/65 bg-white/60 p-3">
              <p className="text-xs font-medium text-slate-700">导出内容与 AI 处理</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <Checkbox
                    checked={exportIncludeTitle}
                    onCheckedChange={(checked) => setExportIncludeTitle(checked === true)}
                  />
                  标题
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <Checkbox
                      checked={exportIncludeDescription}
                      onCheckedChange={(checked) => {
                        const enabled = checked === true;
                        setExportIncludeDescription(enabled);
                        if (!enabled) setExportDescriptionUseLlm(false);
                      }}
                    />
                    描述
                  </label>
                  <label className="ml-6 flex items-center gap-2 text-[11px] text-slate-600">
                    <Checkbox
                      checked={exportIncludeDescription && exportDescriptionUseLlm}
                      disabled={!exportIncludeDescription}
                      onCheckedChange={(checked) => setExportDescriptionUseLlm(checked === true)}
                    />
                    描述走大模型优化
                  </label>
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <Checkbox
                      checked={exportIncludeComments}
                      onCheckedChange={(checked) => {
                        const enabled = checked === true;
                        setExportIncludeComments(enabled);
                        if (!enabled) setExportCommentsUseLlm(false);
                      }}
                    />
                    评论历史
                  </label>
                  <label className="ml-6 flex items-center gap-2 text-[11px] text-slate-600">
                    <Checkbox
                      checked={exportIncludeComments && exportCommentsUseLlm}
                      disabled={!exportIncludeComments}
                      onCheckedChange={(checked) => setExportCommentsUseLlm(checked === true)}
                    />
                    评论走大模型优化（自动生成要点）
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setExportDialogOpen(false)} disabled={exportStarting}>
                取消
              </Button>
              <Button size="sm" onClick={startTaskExport} disabled={!selectedPerson || exportStarting}>
                {exportStarting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1.5 h-3.5 w-3.5" />}
                {exportStarting ? '启动中...' : '开始导出'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
