import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Edit2, Clock, Hash, AlertCircle, User, Flag, ChevronDown, AlignLeft, ListTodo, Plus, MessageSquare, Send, Users, Briefcase, CalendarDays, CalendarClock, Award, Check, Copy, Pin, PinOff, Loader2 } from 'lucide-react';
import { Dropdown } from '@/components/ui/dropdown';
import { PeoplePicker } from '@/components/ui/people-picker';
import { ProjectPicker } from '@/components/ui/project-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { RichContentRenderer } from '@/components/ui/rich-content-renderer';
import { Progress } from '@/components/ui/progress';
import { SubtaskItem } from './SubtaskItem';
import { TaskScoringDialog } from '@/components/ui/TaskScoringDialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Timeline, TimelineItem } from '@/components/ui/Timeline';
import { toast } from 'sonner';
import { Task } from '@/lib/api';
import { getTaskStatusName, TASK_STATUS_NAMES } from '@/lib/constants/taskStatus';
import { httpClient } from '@/lib/httpClient';
import { batchFetchSubtasks, getCachedProjects, getCachedUsers } from '@/lib/conduitBatch';
import { useTaskEdit } from '@/hooks/useTaskEdit';
import { usePinnedPanel } from '@/contexts/PinnedPanelContext';

interface Subtask {
  id: number;
  title: string;
  completed: boolean;
  status?: string;
  expanded: boolean;
  children: Subtask[];
  hasChildren?: boolean;
  isLoadingChildren?: boolean;
}

interface Comment {
  id: number;
  phid: string;
  author: string;
  avatar: string;
  date: string;
  content: string;
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate?: (task: Task) => void;
  overlayZIndex?: string;
  contentZIndex?: string;
}

interface TaskDetailData {
  task: any;
  transactions: any[];
  subtasks?: any[];
}

interface UserCache {
  [phid: string]: {
    realName: string;
    userName: string;
    image: string | null;
  };
}

interface ProjectCache {
  [phid: string]: {
    name: string;
    color: string;
  };
}

export function TaskDetailDialog({ 
  task, 
  open, 
  onOpenChange, 
  onTaskUpdate,
  overlayZIndex = 'z-[10100]',
  contentZIndex = 'z-[10100]'
}: TaskDetailDialogProps) {
  const { addPinnedItem, removePinnedItem, isPinned } = usePinnedPanel();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [taskPriority, setTaskPriority] = useState('');
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');
  const [assignee, setAssignee] = useState<Array<{ id: string; name: string; avatar?: string }>>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [showCompletedSubtasks, setShowCompletedSubtasks] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtaskToId, setAddingSubtaskToId] = useState<number | null>(null);
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [subscribers, setSubscribers] = useState<Array<{ id: string; name: string; avatar?: string }>>([]);
  const [projectTags, setProjectTags] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const [workload, setWorkload] = useState('3天');
  const [plannedCompletion, setPlannedCompletion] = useState<Date | undefined>(undefined);
  const [updatedPlan, setUpdatedPlan] = useState<Date | undefined>(undefined);
  const [isRatingPanelOpen, setIsRatingPanelOpen] = useState(false);
  const [hasRating, setHasRating] = useState(false);
  const [taskScoring, setTaskScoring] = useState<{ workClass: string; workScore: string; completeRate: string } | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState(false);
  const [detailData, setDetailData] = useState<TaskDetailData | null>(null);
  const [userCache, setUserCache] = useState<UserCache>({});
  const [projectCache, setProjectCache] = useState<ProjectCache>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingSubtasksBackground, setIsLoadingSubtasksBackground] = useState(false);
  const [subtasksLoadProgress, setSubtasksLoadProgress] = useState(0);
  const [loadAbortController, setLoadAbortController] = useState<AbortController | null>(null);
  const [secondaryTask, setSecondaryTask] = useState<Task | null>(null);
  const [isLoadingSecondaryTask, setIsLoadingSecondaryTask] = useState(false);

  // Fetch detailed task data when task changes
  useEffect(() => {
    if (!task || !open) return;

    const fetchTaskDetails = async () => {
      setIsLoadingDetails(true);
      setIsLoadingSubtasks(true);
      setIsLoadingComments(true);
      
      // Reset states when switching tasks
      setSubtasks([]);
      setComments([]);
      
      // Cancel previous background loading
      if (loadAbortController) {
        loadAbortController.abort();
      }
      
      try {
        // Fetch detailed task data
        const data = await httpClient<TaskDetailData>(`/api/tasks/${task.id}`);
        setDetailData(data);

        // Initialize basic fields
        setTaskTitle(data.task.fields.name);
        setTaskStatus(data.task.fields.status.value);
        
        // Get priority from task data
        const priorityValue = data.task.fields.priority?.value;
        if (priorityValue !== undefined) {
          setTaskPriority(String(priorityValue));
        }
        
        const desc = data.task.fields.description;
        setTaskDescription(typeof desc === 'string' ? desc : desc?.raw || '');

        // Load custom fields
        const customFields = data.task.fields as any;
        const workloadValue = customFields['custom.tp-link.estimated-days'] || '';
        setWorkload(workloadValue);
        
        // Load first level subtasks immediately and show them
        if (data.subtasks && data.subtasks.length > 0) {
          const rootSubtasks: Subtask[] = data.subtasks
            .filter((st: any) => st.fields?.status?.value !== 'invalid') // 过滤删除/中止的任务
            .map((st: any) => ({
              id: st.id,
              title: st.fields?.name || '未命名子任务',
              completed: st.fields?.status?.value === 'resolved' || st.fields?.status?.value === 'excluded',
              expanded: false,
              children: [],
              hasChildren: true
            }));
          setSubtasks(rootSubtasks);
          setIsLoadingSubtasks(false);
          
          // Start background loading of all subtasks for accurate statistics
          const abortController = new AbortController();
          setLoadAbortController(abortController);
          setIsLoadingSubtasksBackground(true);
          loadAllSubtasksInBackground(rootSubtasks, abortController);
        } else {
          setIsLoadingSubtasks(false);
        }
        
        const estimatedDate = customFields['custom.tp-link.estimated-date-complete'];
        if (estimatedDate) {
          setPlannedCompletion(new Date(estimatedDate * 1000));
        }
        
        const updateDate = customFields['custom.tp-link.update-date-complete'];
        if (updateDate) {
          setUpdatedPlan(new Date(updateDate * 1000));
        }

        // Check if task has scoring - 只有当workClass和workScore都有有效值时才算已打分
        const workClass = customFields['custom.tp-link.work-class'];
        const workScore = customFields['custom.tp-link.work-score'];
        const completeRate = customFields['custom.tp-link.complete-rate'];
        
        // 排除无效值：'0'、'待定'、空字符串、null、undefined
        const isValidWorkClass = workClass && workClass !== '0' && workClass !== '待定';
        const isValidWorkScore = workScore && workScore !== '待定';
        
        if (isValidWorkClass && isValidWorkScore) {
          setHasRating(true);
          setTaskScoring({ workClass: workClass || '', workScore: workScore || '', completeRate: completeRate || '' });
        } else {
          setHasRating(false);
          setTaskScoring(null);
        }

        // Collect all user PHIDs first (including comment authors)
        const userPHIDs = new Set<string>();
        if (data.task.fields?.ownerPHID) {
          userPHIDs.add(data.task.fields.ownerPHID);
        }
        const subscriberPHIDs = data.task.attachments?.subscribers?.subscriberPHIDs || [];
        subscriberPHIDs.forEach((phid: string) => userPHIDs.add(phid));
        
        // Add comment author PHIDs
        const commentTransactions = (data.transactions || [])
          .filter((t: any) => t.comments && t.comments.length > 0);
        commentTransactions.forEach((t: any) => {
          if (t.authorPHID) {
            userPHIDs.add(t.authorPHID);
          }
        });

        if (userPHIDs.size > 0) {
          const usersMap = await getCachedUsers(Array.from(userPHIDs));

          const newUserCache: UserCache = {};
          usersMap.forEach((userData, phid) => {
            if (userData) {
              newUserCache[phid] = {
                realName: userData.realName || userData.fields?.realName || '',
                userName: userData.userName || userData.fields?.username || '',
                image: userData.image || userData.fields?.image || null
              };
            }
          });
          setUserCache(newUserCache);

          // Set assignee
          if (data.task.fields?.ownerPHID && newUserCache[data.task.fields.ownerPHID]) {
            const owner = newUserCache[data.task.fields.ownerPHID];
            setAssignee([{
              id: data.task.fields.ownerPHID,
              name: owner.realName || owner.userName,
              avatar: owner.realName?.charAt(0) || owner.userName?.charAt(0)
            }]);
          }

          // Set subscribers
          const subscriberList = subscriberPHIDs.map((phid: string) => {
            const user = newUserCache[phid];
            return {
              id: phid,
              name: user?.realName || user?.userName || phid,
              avatar: user?.realName?.charAt(0) || user?.userName?.charAt(0)
            };
          }).filter((s: { id: string; name: string; avatar: string | undefined }) => s.name);
          setSubscribers(subscriberList);

          // Process comments with edit/delete markers (after user data is loaded)
          const sortedTransactions = commentTransactions
            .slice()
            .sort((a: any, b: any) => a.dateCreated - b.dateCreated);
          
          // Process edit and delete markers - use PHID as key (same as TaskDetailPanel)
          const commentOverrides = new Map<string, { kind: 'edit' | 'delete'; text: string }>();
          const hiddenTransactionPHIDs = new Set<string>();
          const deletedTargetPHIDs = new Set<string>();

          for (const t of sortedTransactions) {
            for (const c of t.comments) {
              const raw = c.content?.raw || '';
              const editMatch = raw.match(/^\[phabdash-edit:(PHID-XACT-[^\]]+)\]\s*\n([\s\S]*)$/);
              if (editMatch) {
                const targetPHID = editMatch[1];
                const text = (editMatch[2] || '').trim();
                commentOverrides.set(targetPHID, { kind: 'edit', text });
                hiddenTransactionPHIDs.add(t.phid);
                continue;
              }
              const deleteMatch = raw.match(/^\[phabdash-delete:(PHID-XACT-[^\]]+)\]\s*\n([\s\S]*)$/);
              if (deleteMatch) {
                const targetPHID = deleteMatch[1];
                commentOverrides.set(targetPHID, { kind: 'delete', text: '' });
                hiddenTransactionPHIDs.add(t.phid);
                deletedTargetPHIDs.add(targetPHID);
              }
            }
          }

          const commentList: Comment[] = sortedTransactions
            .filter((transaction: any) => {
              // Filter out hidden (marker comments) and deleted target comments
              if (hiddenTransactionPHIDs.has(transaction.phid) || deletedTargetPHIDs.has(transaction.phid)) {
                return false;
              }
              return true;
            })
            .map((transaction: any) => {
              const originalText = transaction.comments[0]?.content?.raw || '';
              const override = commentOverrides.get(transaction.phid);
              const effectiveText = override ? override.text : originalText;
              
              return {
                id: transaction.id,
                phid: transaction.phid,
                author: newUserCache[transaction.authorPHID]?.realName || newUserCache[transaction.authorPHID]?.userName || 'Unknown User',
                avatar: newUserCache[transaction.authorPHID]?.realName?.charAt(0) || 'U',
                date: new Date(transaction.dateCreated * 1000).toLocaleString('zh-CN'),
                content: effectiveText
              };
            })
            .filter((comment) => comment.content.trim().length > 0)
            .reverse();
          
          setComments(commentList);
          setIsLoadingComments(false);
        }

        // Fetch project data using cached batch API
        const projectPHIDs = data.task.attachments?.projects?.projectPHIDs || [];
        if (projectPHIDs.length > 0) {
          const projectsMap = await getCachedProjects(projectPHIDs);

          const newProjectCache: ProjectCache = {};
          projectsMap.forEach((project, phid) => {
            if (project) {
              newProjectCache[phid] = {
                name: project.fields?.name || project.name || 'Unknown Project',
                color: project.fields?.color?.key || 'grey'
              };
            }
          });
          setProjectCache(newProjectCache);

          // Set project tags
          const projectList = projectPHIDs.map((phid: string) => {
            const project = newProjectCache[phid];
            return {
              id: phid,
              name: project?.name || phid,
              color: project?.color
            };
          }).filter((p: { id: string; name: string; color: string | undefined }) => p.name);
          setProjectTags(projectList);
        }

      } catch (error) {
        console.error('Failed to fetch task details:', error);
        toast.error('加载任务详情失败');
        setIsLoadingSubtasks(false);
        setIsLoadingComments(false);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchTaskDetails();
  }, [task, open]);

  const openSecondaryTask = async (subtaskId: number) => {
    setIsLoadingSecondaryTask(true);
    try {
      const data = await httpClient<any>(`/api/tasks/${subtaskId}`);
      const nextTask = (data?.task || null) as Task | null;
      if (!nextTask) {
        throw new Error('未找到子任务详情');
      }
      setSecondaryTask(nextTask);
    } catch (error: any) {
      toast.error(error?.message || '加载子任务详情失败');
    } finally {
      setIsLoadingSecondaryTask(false);
    }
  };

  // Background loading function for all subtasks - uses batch API for efficiency
  const loadAllSubtasksInBackground = async (rootSubtasks: Subtask[], abortController: AbortController) => {
    try {
      let totalLoaded = 0;
      setSubtasksLoadProgress(0);
      
      // Helper to update multiple tasks' children in the tree at once
      const updateMultipleTaskChildren = (
        tasks: Subtask[],
        updates: Map<number, { children: Subtask[]; hasChildren: boolean }>
      ): Subtask[] => {
        return tasks.map(task => {
          const update = updates.get(task.id);
          if (update) {
            return { ...task, children: update.children, hasChildren: update.hasChildren, isLoadingChildren: false };
          }
          if (task.children && task.children.length > 0) {
            return { ...task, children: updateMultipleTaskChildren(task.children, updates) };
          }
          return task;
        });
      };
      
      // Load one level at a time using batch API
      const loadLevel = async (tasksToLoad: Subtask[], level: number): Promise<Subtask[]> => {
        if (level > 5 || abortController.signal.aborted || tasksToLoad.length === 0) {
          return [];
        }
        
        const needsLoading = tasksToLoad.filter(t => t.hasChildren && t.children.length === 0);
        if (needsLoading.length === 0) return [];
        
        const taskIds = needsLoading.map(t => t.id);
        
        // Use batch API to fetch all subtasks at this level in one request
        const subtasksMap = await batchFetchSubtasks(taskIds, {
          onProgress: (completed, total) => {
            setSubtasksLoadProgress(totalLoaded + completed);
          }
        });
        
        if (abortController.signal.aborted) return [];
        
        const updates = new Map<number, { children: Subtask[]; hasChildren: boolean }>();
        const allChildren: Subtask[] = [];
        
        for (const task of needsLoading) {
          const subtaskData = subtasksMap.get(task.id) || [];
          const children: Subtask[] = subtaskData
            .filter((st: any) => st.fields?.status?.value !== 'invalid')
            .map((st: any) => ({
              id: st.id,
              title: st.fields?.name || '未命名子任务',
              completed: st.fields?.status?.value === 'resolved' || st.fields?.status?.value === 'excluded',
              status: st.fields?.status?.value,
              expanded: false,
              children: [],
              hasChildren: true,
              isLoadingChildren: false
            }));
          
          updates.set(task.id, { children, hasChildren: children.length > 0 });
          allChildren.push(...children);
        }
        
        totalLoaded += needsLoading.length;
        
        // Update UI after processing the entire level
        if (!abortController.signal.aborted) {
          setSubtasks(prev => updateMultipleTaskChildren(prev, updates));
          setSubtasksLoadProgress(totalLoaded);
        }
        
        return allChildren;
      };
      
      // Start with root level, then load each subsequent level
      let currentLevel = rootSubtasks;
      let level = 0;
      
      while (currentLevel.length > 0 && level < 6 && !abortController.signal.aborted) {
        const nextLevel = await loadLevel(currentLevel, level);
        currentLevel = nextLevel;
        level++;
      }
      
      if (!abortController.signal.aborted) {
        setIsLoadingSubtasksBackground(false);
      }
      
    } catch (error) {
      console.error('Background subtask loading failed:', error);
      setIsLoadingSubtasksBackground(false);
    }
  };

  // Subtask functions
  const calculateSubtaskStats = (tasks: Subtask[]): { total: number; completed: number; percentage: number } => {
    let total = 0;
    let completed = 0;
    
    const count = (items: Subtask[]) => {
      items.forEach(item => {
        total++;
        if (item.completed) completed++;
        if (item.children && item.children.length > 0) {
          count(item.children);
        }
      });
    };
    
    count(tasks);
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  };

  const toggleSubtask = (taskId: number, event?: React.MouseEvent) => {
    // Find the subtask to get its current status
    const findSubtask = (tasks: Subtask[]): Subtask | null => {
      for (const task of tasks) {
        if (task.id === taskId) return task;
        if (task.children && task.children.length > 0) {
          const found = findSubtask(task.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const subtask = findSubtask(subtasks);
    if (!subtask) return;
    
    const currentStatus = subtask.status || (subtask.completed ? 'resolved' : 'open');
    
    // If reopening a completed task (either 'resolved' or 'excluded')
    if (currentStatus === 'resolved' || currentStatus === 'excluded') {
      handleReopenSubtask(taskId, currentStatus);
      return;
    }
    
    // If completing a task, auto-determine status based on current status
    // If current status is 'wontfix' (进行中不加入统计), complete as 'excluded' (已完成不加入统计)
    // Otherwise, complete as 'resolved' (已完成)
    const statusValue = currentStatus === 'wontfix' ? 'excluded' : 'resolved';
    handleCompleteSubtask(taskId, statusValue);
  };
  
  const handleCompleteSubtask = async (taskId: number, statusValue: string) => {
    setUpdatingSubtaskId(taskId);
    try {
      await httpClient('/api/tasks/edit', {
        method: 'POST',
        body: {
          objectIdentifier: `T${taskId}`,
          transactions: [
            { type: 'status', value: statusValue },
          ],
        },
      });
      
      // Update local state
      const updateStatus = (tasks: Subtask[]): Subtask[] => {
        return tasks.map(task => {
          if (task.id === taskId) {
            return { ...task, completed: true, status: statusValue };
          }
          if (task.children && task.children.length > 0) {
            return { ...task, children: updateStatus(task.children) };
          }
          return task;
        });
      };
      setSubtasks(updateStatus(subtasks));
      
      toast.success(
        statusValue === 'excluded' ? '子任务已完成（不加入统计）' : '子任务已完成'
      );
    } catch (error) {
      toast.error('更新子任务状态失败');
    } finally {
      setUpdatingSubtaskId(null);
    }
  };
  
  const handleReopenSubtask = async (taskId: number, currentStatus: string) => {
    setUpdatingSubtaskId(taskId);
    try {
      // Restore to 'wontfix' if it was 'excluded', otherwise restore to 'open'
      const newStatus = currentStatus === 'excluded' ? 'wontfix' : 'open';
      
      await httpClient('/api/tasks/edit', {
        method: 'POST',
        body: {
          objectIdentifier: `T${taskId}`,
          transactions: [
            { type: 'status', value: newStatus },
          ],
        },
      });
      
      // Update local state
      const updateStatus = (tasks: Subtask[]): Subtask[] => {
        return tasks.map(task => {
          if (task.id === taskId) {
            return { ...task, completed: false, status: newStatus };
          }
          if (task.children && task.children.length > 0) {
            return { ...task, children: updateStatus(task.children) };
          }
          return task;
        });
      };
      setSubtasks(updateStatus(subtasks));
      
      toast.success('子任务已重新打开');
    } catch (error) {
      toast.error('更新子任务状态失败');
    } finally {
      setUpdatingSubtaskId(null);
    }
  };

  const toggleExpand = async (taskId: number) => {
    // Find the task and check if we need to load children
    const findAndToggle = async (tasks: Subtask[]): Promise<Subtask[]> => {
      const result: Subtask[] = [];
      for (const task of tasks) {
        if (task.id === taskId) {
          const newExpanded = !task.expanded;
          
          // If expanding and no children loaded yet, fetch them
          if (newExpanded && task.children.length === 0 && task.hasChildren) {
            try {
              const subtaskData = await httpClient<any>(`/api/tasks/${taskId}`);
              const children = subtaskData?.subtasks
                ?.filter((st: any) => st.fields?.status?.value !== 'invalid') // 过滤删除/中止的任务
                .map((st: any) => ({
                  id: st.id,
                  title: st.fields?.name || '未命名子任务',
                  completed: st.fields?.status?.value === 'resolved' || st.fields?.status?.value === 'excluded',
                  status: st.fields?.status?.value,
                  expanded: false,
                  children: [],
                  hasChildren: true
                })) || [];
              
              result.push({ ...task, expanded: newExpanded, children, isLoadingChildren: false });
            } catch (error) {
              console.error(`Failed to load subtasks for task ${taskId}:`, error);
              result.push({ ...task, expanded: newExpanded, isLoadingChildren: false });
            }
          } else {
            result.push({ ...task, expanded: newExpanded });
          }
        } else if (task.children && task.children.length > 0) {
          const updatedChildren = await findAndToggle(task.children);
          result.push({ ...task, children: updatedChildren });
        } else {
          result.push(task);
        }
      }
      return result;
    };
    
    const updatedSubtasks = await findAndToggle(subtasks);
    setSubtasks(updatedSubtasks);
  };

  const getAllSubtaskIds = (tasks: Subtask[]): number[] => {
    let ids: number[] = [];
    tasks.forEach(task => {
      ids.push(task.id);
      if (task.children && task.children.length > 0) {
        ids = [...ids, ...getAllSubtaskIds(task.children)];
      }
    });
    return ids;
  };

  const findSubtaskPHID = (tasks: Subtask[], taskId: number): string | null => {
    for (const task of tasks) {
      if (task.id === taskId) {
        return `PHID-TASK-${task.id}`; // This is a placeholder, we need the actual PHID
      }
      if (task.children && task.children.length > 0) {
        const found = findSubtaskPHID(task.children, taskId);
        if (found) return found;
      }
    }
    return null;
  };

  const addSubtask = async (parentId: number | null) => {
    if (!newSubtaskTitle.trim() || !task) return;
    
    try {
      // Determine the correct parent PHID
      let parentPHID: string;
      if (parentId === null || parentId === 0) {
        // Adding to root level
        parentPHID = task.phid;
      } else {
        // Adding to a nested subtask - need to fetch the parent's PHID
        const parentData = await httpClient<any>(`/api/tasks/${parentId}`);
        if (!parentData?.task?.phid) {
          throw new Error('Failed to get parent task PHID');
        }
        parentPHID = parentData.task.phid;
      }
      
      // Create subtask via API
      const response = await httpClient<any>('/api/tasks/create', {
        method: 'POST',
        body: {
          title: newSubtaskTitle,
          description: '',
          parentTask: parentPHID,
          projects: detailData?.task?.attachments?.projects?.projectPHIDs || []
        }
      });
      
      // Extract the actual task ID from the response
      const createdTaskId = response?.object?.id;
      if (!createdTaskId) {
        throw new Error('Failed to get created task ID from response');
      }
      
      // Add to local state with the real task ID
      const newTask: Subtask = {
        id: createdTaskId,
        title: newSubtaskTitle,
        completed: false,
        expanded: false,
        children: [],
        hasChildren: false
      };
      
      if (parentId === null || parentId === 0) {
        setSubtasks([...subtasks, newTask]);
      } else {
        const addToParent = (tasks: Subtask[]): Subtask[] => {
          return tasks.map(task => {
            if (task.id === parentId) {
              return {
                ...task,
                children: [...task.children, newTask],
                expanded: true,
                hasChildren: true
              };
            }
            if (task.children && task.children.length > 0) {
              return { ...task, children: addToParent(task.children) };
            }
            return task;
          });
        };
        setSubtasks(addToParent(subtasks));
      }
      
      setNewSubtaskTitle('');
      setAddingSubtaskToId(null);
      toast.success('子任务已添加');
    } catch (error) {
      console.error('Failed to create subtask:', error);
      toast.error('添加子任务失败');
    }
  };

  const deleteSubtask = (taskId: number) => {
    const deleteFromTree = (tasks: Subtask[]): Subtask[] => {
      return tasks
        .filter(task => task.id !== taskId)
        .map(task => {
          if (task.children && task.children.length > 0) {
            return { ...task, children: deleteFromTree(task.children) };
          }
          return task;
        });
    };
    setSubtasks(deleteFromTree(subtasks));
    toast.success('子任务已删除');
  };

  const filterSubtasks = (tasks: Subtask[]): Subtask[] => {
    if (showCompletedSubtasks) return tasks;
    
    return tasks
      .map(task => ({
        ...task,
        children: task.children ? filterSubtasks(task.children) : []
      }))
      .filter(task => {
        // 如果任务未完成，显示
        if (!task.completed) return true;
        // 如果任务已完成，但有未完成的子任务，也要显示（以便显示子任务）
        if (task.children && task.children.length > 0) return true;
        // 已完成且没有子任务，隐藏
        return false;
      });
  };

  // Refresh comments from server
  const refreshComments = async (taskId: number) => {
    try {
      const data = await httpClient<TaskDetailData>(`/api/tasks/${taskId}`);
      setDetailData(data);
      
      // Process comments
      const commentTransactions = (data.transactions || [])
        .filter((t: any) => t.comments && t.comments.length > 0);
      
      // Collect user PHIDs
      const userPHIDs = new Set<string>();
      commentTransactions.forEach((t: any) => {
        if (t.authorPHID) userPHIDs.add(t.authorPHID);
      });
      
      let newUserCache = { ...userCache };
      if (userPHIDs.size > 0) {
        const usersMap = await getCachedUsers(Array.from(userPHIDs));
        usersMap.forEach((userData, phid) => {
          if (userData) {
            newUserCache[phid] = {
              realName: userData.realName || userData.fields?.realName || '',
              userName: userData.userName || userData.fields?.username || '',
              image: userData.image || userData.fields?.image || null
            };
          }
        });
        setUserCache(newUserCache);
      }
      
      // Process comments with edit/delete markers
      const sortedTransactions = commentTransactions
        .slice()
        .sort((a: any, b: any) => a.dateCreated - b.dateCreated);
      
      const commentOverrides = new Map<string, { kind: 'edit' | 'delete'; text: string }>();
      const hiddenTransactionPHIDs = new Set<string>();
      const deletedTargetPHIDs = new Set<string>();

      for (const t of sortedTransactions) {
        for (const c of t.comments) {
          const raw = c.content?.raw || '';
          const editMatch = raw.match(/^\[phabdash-edit:(PHID-XACT-[^\]]+)\]\s*\n([\s\S]*)$/);
          if (editMatch) {
            commentOverrides.set(editMatch[1], { kind: 'edit', text: (editMatch[2] || '').trim() });
            hiddenTransactionPHIDs.add(t.phid);
            continue;
          }
          const deleteMatch = raw.match(/^\[phabdash-delete:(PHID-XACT-[^\]]+)\]\s*\n([\s\S]*)$/);
          if (deleteMatch) {
            commentOverrides.set(deleteMatch[1], { kind: 'delete', text: '' });
            hiddenTransactionPHIDs.add(t.phid);
            deletedTargetPHIDs.add(deleteMatch[1]);
          }
        }
      }

      const commentList: Comment[] = sortedTransactions
        .filter((transaction: any) => {
          if (hiddenTransactionPHIDs.has(transaction.phid) || deletedTargetPHIDs.has(transaction.phid)) return false;
          return true;
        })
        .map((transaction: any) => {
          const originalText = transaction.comments[0]?.content?.raw || '';
          const override = commentOverrides.get(transaction.phid);
          const effectiveText = override ? override.text : originalText;
          return {
            id: transaction.id,
            phid: transaction.phid,
            author: newUserCache[transaction.authorPHID]?.realName || newUserCache[transaction.authorPHID]?.userName || 'Unknown User',
            avatar: newUserCache[transaction.authorPHID]?.realName?.charAt(0) || 'U',
            date: new Date(transaction.dateCreated * 1000).toLocaleString('zh-CN'),
            content: effectiveText
          };
        })
        .filter((comment) => comment.content.trim().length > 0)
        .reverse();
      
      setComments(commentList);
    } catch (error) {
      console.error('Failed to refresh comments:', error);
    }
  };

  const handleEditComment = (commentId: number) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      setEditingCommentId(commentId);
      setEditingCommentText(comment.content);
    }
  };

  const handleSaveComment = (commentId: number) => {
    if (!editingCommentText.trim()) return;
    setComments(comments.map(c => 
      c.id === commentId ? { ...c, content: editingCommentText } : c
    ));
    setEditingCommentId(null);
    setEditingCommentText('');
    toast.success('评论已更新');
  };

  const handleDeleteComment = (commentId: number) => {
    setComments(comments.filter(c => c.id !== commentId));
    toast.success('评论已删除');
  };

  const handleCopyTaskId = async () => {
    if (task) {
      try {
        // Try modern Clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(`T${task.id}`);
          setCopiedTaskId(true);
          setTimeout(() => setCopiedTaskId(false), 2000);
          toast.success('任务ID已复制');
        } else {
          // Fallback to execCommand
          const textArea = document.createElement('textarea');
          textArea.value = `T${task.id}`;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            setCopiedTaskId(true);
            setTimeout(() => setCopiedTaskId(false), 2000);
            toast.success('任务ID已复制');
          } else {
            throw new Error('Copy failed');
          }
        }
      } catch (err) {
        console.error('Failed to copy:', err);
        toast.error('复制失败');
      }
    }
  };

  const handleTitleSave = async () => {
    setIsEditingTitle(false);
    if (taskTitle.trim() && task && taskTitle !== task.fields.name) {
      try {
        await httpClient('/api/tasks/edit', {
          method: 'POST',
          body: {
            objectIdentifier: `T${task.id}`,
            transactions: [{ type: 'title', value: taskTitle }]
          }
        });
        toast.success('标题已更新');
        if (onTaskUpdate) {
          const updatedTask = { ...task, fields: { ...task.fields, name: taskTitle } };
          onTaskUpdate(updatedTask);
        }
      } catch (error) {
        toast.error('更新标题失败');
      }
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setIsEditingTitle(false);
    setIsEditingDescription(false);
  };

  const handleScoringConfirm = async (data: { workClass: string; workScore: string; completeRate: string }) => {
    setTaskScoring(data);
    setHasRating(true);
    if (!task) return;
    
    setIsRatingPanelOpen(false);
    try {
      await httpClient('/api/tasks/edit', {
        method: 'POST',
        body: {
          objectIdentifier: `T${task.id}`,
          transactions: [
            { type: 'custom.tp-link.work-class', value: data.workClass },
            { type: 'custom.tp-link.work-score', value: data.workScore },
            { type: 'custom.tp-link.complete-rate', value: data.completeRate }
          ]
        }
      });
      toast.success('任务评分已保存');
    } catch (error) {
      toast.error('保存评分失败');
    }
  };

  if (!task) return null;


  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 bg-black/50 ${overlayZIndex}`} />
        <Dialog.Content 
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col ${contentZIndex}`}
          onPointerDownOutside={(e) => {
            e.preventDefault();
          }}
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
        >
          {/* Fixed Header */}
          <div className="flex-shrink-0 border-b border-neutral-200 px-6 py-4 flex items-center justify-between bg-white rounded-t-lg">
            {isEditingTitle ? (
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                className="text-lg font-semibold text-neutral-900 border-b-2 border-blue-600 focus:outline-none flex-1"
                autoFocus
              />
            ) : (
              <Dialog.Title className="text-lg font-semibold text-neutral-900 flex items-center gap-2 flex-1 group">
                {taskTitle}
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-600 transition-opacity"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </Dialog.Title>
            )}
            <div className="flex items-center gap-2">
              {task && (
                <button
                  onClick={() => {
                    const pinId = `task-${task.id}`;
                    if (isPinned(pinId)) {
                      removePinnedItem(pinId);
                    } else {
                      addPinnedItem({
                        id: pinId,
                        type: 'task',
                        title: `T${task.id}: ${taskTitle}`,
                        taskId: task.id,
                      });
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
                    task && isPinned(`task-${task.id}`)
                      ? 'text-blue-700 bg-blue-100 hover:bg-blue-200' 
                      : 'text-neutral-700 bg-neutral-100 hover:bg-neutral-200'
                  }`}
                  title={task && isPinned(`task-${task.id}`) ? 'Unpin from panel' : 'Pin to panel'}
                >
                  {task && isPinned(`task-${task.id}`) ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                  <span>{task && isPinned(`task-${task.id}`) ? '取消固定' : '固定'}</span>
                </button>
              )}
              <button
                onClick={() => {
                  setIsRatingPanelOpen(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
                  hasRating 
                    ? 'text-amber-700 bg-amber-100 hover:bg-amber-200' 
                    : 'text-neutral-700 bg-neutral-100 hover:bg-neutral-200'
                }`}
              >
                <Award className="h-3.5 w-3.5" />
                <span>{hasRating ? '修改评分' : '任务打分'}</span>
              </button>
              <Dialog.Close className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
          </div>
          <Dialog.Description className="sr-only">
            Task details for {task.id}
          </Dialog.Description>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Task Details Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-neutral-500" />
                任务详情
              </h3>

              {/* Always visible fields */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                  <span className="text-neutral-500 w-16 flex-shrink-0 text-xs">任务 ID:</span>
                  <button
                    onClick={handleCopyTaskId}
                    className="font-mono text-neutral-900 hover:text-blue-600 transition-colors flex items-center gap-1 group text-xs"
                  >
                    T{task.id}
                    {copiedTaskId ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 text-neutral-400" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                  <span className="text-neutral-500 w-16 flex-shrink-0 text-xs">状态:</span>
                  <Dropdown
                    options={Object.entries(TASK_STATUS_NAMES).map(([value, label]) => ({
                      value,
                      label
                    }))}
                    value={taskStatus}
                    onValueChange={async (value) => {
                      setTaskStatus(value);
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: {
                            objectIdentifier: `T${task.id}`,
                            transactions: [{ type: 'status', value }]
                          }
                        });
                        toast.success(`状态已更新为: ${getTaskStatusName(value)}`);
                        if (onTaskUpdate) {
                          const updatedTask = { 
                            ...task, 
                            fields: { 
                              ...task.fields, 
                              status: { 
                                value, 
                                name: getTaskStatusName(value),
                                color: task.fields.status.color 
                              } 
                            } 
                          };
                          onTaskUpdate(updatedTask);
                        }
                      } catch (error) {
                        toast.error('更新状态失败');
                      }
                    }}
                    className="-ml-3 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                  <span className="text-neutral-500 w-16 flex-shrink-0 text-xs">指派给:</span>
                  <PeoplePicker
                    selected={assignee}
                    onAdd={async (person) => {
                      setAssignee([person]);
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: {
                            objectIdentifier: `T${task.id}`,
                            transactions: [{ type: 'owner', value: person.id }]
                          }
                        });
                        toast.success(`已指派给: ${person.name}`);
                      } catch (error) {
                        toast.error('指派失败');
                      }
                    }}
                    onRemove={async () => {
                      setAssignee([]);
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: {
                            objectIdentifier: `T${task.id}`,
                            transactions: [{ type: 'owner', value: '' }]
                          }
                        });
                        toast.success('已移除指派');
                      } catch (error) {
                        toast.error('移除指派失败');
                      }
                    }}
                    maxSelections={1}
                    popoverZIndex={contentZIndex === 'z-[10250]' ? 10300 : 10200}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                  <span className="text-neutral-500 w-16 flex-shrink-0 text-xs">优先级:</span>
                  <Dropdown
                    options={[
                      { value: '100', label: 'P1 紧急' },
                      { value: '90', label: 'P2 高' },
                      { value: '80', label: 'P3 中' },
                      { value: '50', label: 'P4 普通' },
                      { value: '25', label: 'P5 低' },
                      { value: '0', label: 'P6 微不足道' },
                    ]}
                    value={taskPriority}
                    onValueChange={async (value) => {
                      // 将数字值映射为Phabricator的优先级关键字
                      const priorityKeywordMap: Record<string, string> = {
                        '100': 'unbreak',
                        '90': 'triage',
                        '80': 'high',
                        '50': 'normal',
                        '25': 'low',
                        '0': 'wish'
                      };
                      const priorityKeyword = priorityKeywordMap[value] || 'normal';
                      
                      setTaskPriority(value);
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: {
                            objectIdentifier: `T${task.id}`,
                            transactions: [{ type: 'priority', value: priorityKeyword }]
                          }
                        });
                        toast.success('优先级已更新');
                      } catch (error) {
                        toast.error('更新优先级失败');
                      }
                    }}
                    className="-ml-3 text-xs"
                  />
                </div>
              </div>

              {/* Expand/Collapse button */}
              <button
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${isDetailsExpanded ? 'rotate-180' : ''}`} />
                <span>{isDetailsExpanded ? '收起详情' : '展开更多详情'}</span>
              </button>

              {/* Expandable fields */}
              {isDetailsExpanded && (
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Users className="h-3 w-3 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <span className="text-neutral-500 w-16 flex-shrink-0 text-xs">订阅者:</span>
                    <PeoplePicker
                      selected={subscribers}
                      onAdd={async (person) => {
                        setSubscribers([...subscribers, person]);
                        try {
                          await httpClient('/api/tasks/edit', {
                            method: 'POST',
                            body: {
                              objectIdentifier: `T${task.id}`,
                              transactions: [{ type: 'subscribers.add', value: [person.id] }]
                            }
                          });
                          toast.success(`已添加订阅者: ${person.name}`);
                        } catch (error) {
                          toast.error('添加订阅者失败');
                        }
                      }}
                      onRemove={async (personId) => {
                        setSubscribers(subscribers.filter(s => s.id !== personId));
                        try {
                          await httpClient('/api/tasks/edit', {
                            method: 'POST',
                            body: {
                              objectIdentifier: `T${task.id}`,
                              transactions: [{ type: 'subscribers.remove', value: [personId] }]
                            }
                          });
                          toast.success('已移除订阅者');
                        } catch (error) {
                          toast.error('移除订阅者失败');
                        }
                      }}
                      popoverZIndex={contentZIndex === 'z-[10250]' ? 10300 : 10200}
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <Briefcase className="h-3 w-3 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <span className="text-neutral-500 w-16 flex-shrink-0 text-xs">项目标签:</span>
                    <ProjectPicker
                      selected={projectTags}
                      onAdd={async (project) => {
                        setProjectTags([project]);
                        try {
                          await httpClient('/api/tasks/edit', {
                            method: 'POST',
                            body: {
                              objectIdentifier: `T${task.id}`,
                              transactions: [{ type: 'projects.add', value: [project.id] }]
                            }
                          });
                          toast.success(`已设置项目: ${project.name}`);
                        } catch (error) {
                          toast.error('设置项目失败');
                        }
                      }}
                      onRemove={async (projectId) => {
                        setProjectTags([]);
                        try {
                          await httpClient('/api/tasks/edit', {
                            method: 'POST',
                            body: {
                              objectIdentifier: `T${task.id}`,
                              transactions: [{ type: 'projects.remove', value: [projectId] }]
                            }
                          });
                          toast.success('已移除项目标签');
                        } catch (error) {
                          toast.error('移除项目失败');
                        }
                      }}
                      maxSelections={1}
                      dropdownZIndex={contentZIndex === 'z-[10250]' ? 10300 : 50}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                    <span className="text-neutral-500 w-16 flex-shrink-0 text-xs">工作量:</span>
                    <div className="inline-flex items-center gap-1">
                      <input
                          type="text"
                          value={workload}
                          onChange={(e) => setWorkload(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur(); // 让输入框失焦，触发onBlur
                            }
                          }}
                          onBlur={async () => {
                            if (!workload.trim()) {
                              return; // 空值不处理
                            }

                            // 验证和格式化工作量输入
                            const validateAndFormatWorkload = (input: string): { valid: boolean; formatted: string; error?: string } => {
                              const trimmed = input.trim();
                              
                              // 移除所有空格
                              const cleaned = trimmed.replace(/\s+/g, '');
                              
                              // 转换D为d
                              const normalized = cleaned.replace(/D/g, 'd');
                              
                              // 检查格式：数字+可选的d
                              const match = normalized.match(/^(\d+\.?\d*|\d*\.\d+)(d)?$/i);
                              
                              if (!match) {
                                return { 
                                  valid: false, 
                                  formatted: '', 
                                  error: '工作量格式不正确，请输入数字+d的组合（如：1d、2d、0.5d）' 
                                };
                              }
                              
                              const number = match[1];
                              const hasSuffix = match[2];
                              
                              // 验证数字有效性
                              const numValue = parseFloat(number);
                              if (isNaN(numValue) || numValue <= 0) {
                                return { 
                                  valid: false, 
                                  formatted: '', 
                                  error: '工作量必须大于0' 
                                };
                              }
                              
                              // 自动补d
                              const formatted = hasSuffix ? normalized : `${number}d`;
                              
                              return { valid: true, formatted };
                            };

                            const result = validateAndFormatWorkload(workload);
                            
                            if (!result.valid) {
                              toast.error(result.error || '工作量格式不正确');
                              // 回退到原值（从后台重新加载）
                              const customFields = detailData?.task?.fields as any;
                              const originalValue = customFields?.['custom.tp-link.estimated-days'] || '';
                              setWorkload(originalValue);
                              return;
                            }

                            // 更新为格式化后的值
                            setWorkload(result.formatted);

                            try {
                              await httpClient('/api/tasks/edit', {
                                method: 'POST',
                                body: {
                                  objectIdentifier: `T${task.id}`,
                                  transactions: [{ type: 'custom.tp-link.estimated-days', value: result.formatted }]
                                }
                              });
                              toast.success('工作量已更新');
                            } catch (error) {
                              toast.error('更新工作量失败');
                              // 回退到原值
                              const customFields = detailData?.task?.fields as any;
                              const originalValue = customFields?.['custom.tp-link.estimated-days'] || '';
                              setWorkload(originalValue);
                            }
                          }}
                          maxLength={10}
                          placeholder="如：1d、0.5d"
                          className="text-xs px-2 py-0.5 border border-neutral-300 rounded focus:outline-none focus:border-blue-600"
                        />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                    <span className="text-neutral-500 w-16 flex-shrink-0 text-xs">计划完成:</span>
                    <DatePicker
                      value={plannedCompletion}
                      onChange={async (date) => {
                        setPlannedCompletion(date);
                        try {
                          const timestamp = date ? Math.floor(date.getTime() / 1000) : null;
                          await httpClient('/api/tasks/edit', {
                            method: 'POST',
                            body: {
                              objectIdentifier: `T${task.id}`,
                              transactions: [{ type: 'custom.tp-link.estimated-date-complete', value: timestamp }]
                            }
                          });
                          toast.success(date ? '计划完成时间已更新' : '计划完成时间已清除');
                        } catch (error) {
                          toast.error('更新计划完成时间失败');
                        }
                      }}
                      placeholder="选择日期"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                    <span className="text-neutral-500 w-16 flex-shrink-0 text-xs">更新计划:</span>
                    <DatePicker
                      value={updatedPlan}
                      onChange={async (date) => {
                        setUpdatedPlan(date);
                        try {
                          const timestamp = date ? Math.floor(date.getTime() / 1000) : null;
                          await httpClient('/api/tasks/edit', {
                            method: 'POST',
                            body: {
                              objectIdentifier: `T${task.id}`,
                              transactions: [{ type: 'custom.tp-link.update-date-complete', value: timestamp }]
                            }
                          });
                          toast.success(date ? '更新计划已设置' : '更新计划已清除');
                        } catch (error) {
                          toast.error('更新计划失败');
                        }
                      }}
                      placeholder="选择日期"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2 group">
              <h4 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-neutral-500" />
                描述
                {!isEditingDescription && (
                  <button
                    onClick={() => setIsEditingDescription(true)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-600 transition-opacity"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </h4>
              {isEditingDescription ? (
                <div className="space-y-2">
                  <textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="w-full text-sm text-neutral-700 bg-white border border-neutral-300 rounded p-3 focus:outline-none focus:border-blue-600 resize-none"
                    rows={6}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setIsEditingDescription(false);
                        try {
                          await httpClient('/api/tasks/edit', {
                            method: 'POST',
                            body: {
                              objectIdentifier: `T${task.id}`,
                              transactions: [{ type: 'description', value: taskDescription }]
                            }
                          });
                          toast.success('描述已更新');
                          if (onTaskUpdate) {
                            const updatedTask = { ...task, fields: { ...task.fields, description: { raw: taskDescription } } };
                            onTaskUpdate(updatedTask);
                          }
                        } catch (error) {
                          toast.error('更新描述失败');
                        }
                      }}
                      className="px-3 py-1.5 bg-neutral-900 text-white text-xs rounded hover:bg-neutral-800"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setIsEditingDescription(false)}
                      className="px-3 py-1.5 text-neutral-600 text-xs hover:bg-neutral-100 rounded"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-neutral-600 bg-neutral-50 rounded p-3">
                  <RichContentRenderer content={taskDescription || '暂无描述'} />
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div className="space-y-2">
              {(() => {
                const stats = calculateSubtaskStats(subtasks);
                const filteredSubtasks = filterSubtasks(subtasks);
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                        <ListTodo className="h-4 w-4 text-neutral-500" />
                        <span>子任务</span>
                        {!isLoadingSubtasks && (
                          <span className="text-xs text-neutral-500 font-normal">
                            {stats.completed}/{stats.total} ({stats.percentage}%)
                          </span>
                        )}
                        {isLoadingSubtasksBackground && (
                          <span className="text-xs text-blue-600 font-normal flex items-center gap-1">
                            <LoadingSpinner message="" size="sm" className="!gap-0" />
                            递归加载中 {subtasksLoadProgress}
                          </span>
                        )}
                      </h4>
                      {subtasks.length > 0 && (
                        <button
                          onClick={() => setShowCompletedSubtasks(!showCompletedSubtasks)}
                          className="text-xs text-neutral-600 hover:text-neutral-900 px-2 py-1 hover:bg-neutral-100 rounded transition-colors"
                        >
                          {showCompletedSubtasks ? '隐藏已完成' : '显示已完成'}
                        </button>
                      )}
                    </div>
                    {isLoadingSubtasks ? (
                      <div className="py-8">
                        <LoadingSpinner message="加载子任务..." size="md" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {subtasks.length > 0 && (
                          <>
                            <Progress value={stats.percentage} className="h-2" />
                            
                            {/* Subtask List */}
                            <div className="space-y-1">
                              {filteredSubtasks.map((task) => (
                                <SubtaskItem
                                  key={task.id}
                                  task={task}
                                  level={0}
                                  onToggle={toggleSubtask}
                                  onExpand={toggleExpand}
                                  onAddChild={setAddingSubtaskToId}
                                  onDelete={deleteSubtask}
                                  onClick={(subtask) => {
                                    openSecondaryTask(subtask.id);
                                  }}
                                />
                              ))}
                            </div>
                          </>
                        )}
                        
                        {/* Add New Subtask Input */}
                        {addingSubtaskToId !== null && (
                          <div className="mt-3 p-3 bg-gradient-to-br from-blue-50 to-neutral-50 rounded-lg border-2 border-blue-200 shadow-sm">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') addSubtask(addingSubtaskToId === 0 ? null : addingSubtaskToId);
                                  if (e.key === 'Escape') {
                                    setAddingSubtaskToId(null);
                                    setNewSubtaskTitle('');
                                  }
                                }}
                                placeholder="输入子任务标题..."
                                className="flex-1 text-sm px-3 py-2 border-2 border-neutral-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-neutral-400"
                                autoFocus
                              />
                              <button
                                onClick={() => addSubtask(addingSubtaskToId === 0 ? null : addingSubtaskToId)}
                                disabled={!newSubtaskTitle.trim()}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                              >
                                添加
                              </button>
                              <button
                                onClick={() => {
                                  setAddingSubtaskToId(null);
                                  setNewSubtaskTitle('');
                                }}
                                className="px-4 py-2 text-neutral-700 text-sm font-medium hover:bg-white/80 rounded-md transition-all"
                              >
                                取消
                              </button>
                            </div>
                            <p className="text-xs text-neutral-500 mt-2 ml-1">按 Enter 确认，Esc 取消</p>
                          </div>
                        )}
                        
                        {/* Add Root Level Subtask Button */}
                        {addingSubtaskToId === null && (
                          subtasks.length > 0 ? (
                            <button
                              onClick={() => setAddingSubtaskToId(0)}
                              className="flex items-center gap-2 text-sm text-neutral-600 hover:text-blue-600 mt-3 px-3 py-2 hover:bg-blue-50 rounded-lg transition-all font-medium"
                            >
                              <Plus className="h-4 w-4" />
                              添加子任务
                            </button>
                          ) : (
                            <button
                              onClick={() => setAddingSubtaskToId(0)}
                              className="flex items-center gap-2 text-sm text-neutral-600 hover:text-blue-600 px-3 py-2 hover:bg-blue-50 rounded-lg transition-all font-medium w-full justify-center border-2 border-dashed border-neutral-200 hover:border-blue-300"
                            >
                              <Plus className="h-4 w-4" />
                              添加第一个子任务
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Comments */}
            {isLoadingComments ? (
              <div className="py-8">
                <LoadingSpinner message="加载评论和历史..." size="md" />
              </div>
            ) : (
              <Timeline
                title="评论和历史"
                items={comments.map((comment) => ({
                  id: comment.phid,
                  author: comment.author,
                  authorImage: null,
                  content: comment.content,
                  timestamp: comment.date,
                }))}
                emptyMessage="暂无评论"
                addPlaceholder="添加评论..."
                showAddInput={true}
                onEdit={async (itemId: number | string, newContent: string) => {
                  if (!task) return;
                  const transactionPHID = String(itemId);
                  const marker = `[phabdash-edit:${transactionPHID}]\n${newContent}`;
                  await httpClient('/api/tasks/edit', {
                    method: 'POST',
                    body: {
                      objectIdentifier: `T${task.id}`,
                      transactions: [{ type: 'comment', value: marker }],
                    },
                  });
                  await refreshComments(task.id);
                  toast.success('评论已更新');
                }}
                onDelete={async (itemId: number | string) => {
                  if (!task) return;
                  const transactionPHID = String(itemId);
                  const deletedText = 'This comment has been deleted.';
                  const marker = `[phabdash-delete:${transactionPHID}]\n${deletedText}`;
                  await httpClient('/api/tasks/edit', {
                    method: 'POST',
                    body: {
                      objectIdentifier: `T${task.id}`,
                      transactions: [{ type: 'comment', value: marker }],
                    },
                  });
                  await refreshComments(task.id);
                }}
                onAdd={async (content: string) => {
                  if (!task) return;
                  await httpClient('/api/tasks/edit', {
                    method: 'POST',
                    body: {
                      objectIdentifier: `T${task.id}`,
                      transactions: [{ type: 'comment', value: content }],
                    },
                  });
                  // Refresh comments from server
                  await refreshComments(task.id);
                  toast.success('评论已添加');
                }}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Task Scoring Dialog */}
      <TaskScoringDialog
        isOpen={isRatingPanelOpen}
        onClose={() => {
          setIsRatingPanelOpen(false);
        }}
        onConfirm={handleScoringConfirm}
        currentValues={taskScoring || undefined}
        isScored={hasRating}
        autoMappedWorkClass={(() => {
          const mappedValue = !hasRating && workload ? workload : undefined;
          return mappedValue;
        })()}
      />

      {/* Secondary Task Panel - reuses TaskDetailDialog with dynamic offset */}
      {secondaryTask && (
        <TaskDetailDialog
          task={secondaryTask}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSecondaryTask(null);
            }
          }}
          onTaskUpdate={(updatedTask) => {
            setSecondaryTask(updatedTask);
            // Refresh parent task's subtasks
            if (task) {
              httpClient<TaskDetailData>(`/api/tasks/${task.id}`)
                .then((data) => setDetailData(data))
                .catch(() => {});
            }
          }}
          overlayZIndex="z-[10250]"
          contentZIndex="z-[10250]"
        />
      )}

      {isLoadingSecondaryTask && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[10240]">
          <div className="bg-white rounded-lg shadow-lg px-4 py-3">
            <LoadingSpinner message="加载子任务详情..." size="md" />
          </div>
        </div>
      )}
    </Dialog.Root>
  );
}
