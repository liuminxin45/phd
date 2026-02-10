import { useState, useEffect } from 'react';
import { 
  X, Edit2, Clock, Hash, AlertCircle, User, Flag, ChevronDown, AlignLeft, 
  ListTodo, Plus, MessageSquare, Send, Users, Briefcase, CalendarDays, 
  CalendarClock, Award, Check, Copy, Pin, PinOff, Loader2 
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeoplePicker } from '@/components/ui/people-picker';
import { ProjectPicker } from '@/components/ui/project-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { RichContentRenderer } from '@/components/ui/rich-content-renderer';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SubtaskItem } from './SubtaskItem';
import { TaskScoringDialog } from '@/components/ui/TaskScoringDialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Timeline } from '@/components/ui/Timeline';
import { toast } from 'sonner';
import { Task } from '@/lib/api';
import { getTaskStatusName, TASK_STATUS_NAMES } from '@/lib/constants/taskStatus';
import { httpClient } from '@/lib/httpClient';
import { batchFetchSubtasks, getCachedProjects, getCachedUsers } from '@/lib/conduitBatch';
import { usePinnedPanel } from '@/contexts/PinnedPanelContext';
import { cn } from '@/lib/utils';

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
  overlayZIndex,
  contentZIndex
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
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  useEffect(() => {
    if (!task || !open) return;

    const fetchTaskDetails = async () => {
      setIsLoadingDetails(true);
      setIsLoadingSubtasks(true);
      setIsLoadingComments(true);
      
      setSubtasks([]);
      setComments([]);
      
      if (loadAbortController) {
        loadAbortController.abort();
      }
      
      try {
        const data = await httpClient<TaskDetailData>(`/api/tasks/${task.id}`);
        setDetailData(data);

        setTaskTitle(data.task.fields.name);
        setTaskStatus(data.task.fields.status.value);
        
        const priorityValue = data.task.fields.priority?.value;
        if (priorityValue !== undefined) {
          setTaskPriority(String(priorityValue));
        }
        
        const desc = data.task.fields.description;
        setTaskDescription(typeof desc === 'string' ? desc : desc?.raw || '');

        const customFields = data.task.fields as any;
        const workloadValue = customFields['custom.tp-link.estimated-days'] || '';
        setWorkload(workloadValue);
        
        if (data.subtasks && data.subtasks.length > 0) {
          const rootSubtasks: Subtask[] = data.subtasks
            .filter((st: any) => st.fields?.status?.value !== 'invalid')
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

        const workClass = customFields['custom.tp-link.work-class'];
        const workScore = customFields['custom.tp-link.work-score'];
        const completeRate = customFields['custom.tp-link.complete-rate'];
        
        const isValidWorkClass = workClass && workClass !== '0' && workClass !== '待定';
        const isValidWorkScore = workScore && workScore !== '待定';
        
        if (isValidWorkClass && isValidWorkScore) {
          setHasRating(true);
          setTaskScoring({ workClass: workClass || '', workScore: workScore || '', completeRate: completeRate || '' });
        } else {
          setHasRating(false);
          setTaskScoring(null);
        }

        const userPHIDs = new Set<string>();
        if (data.task.fields?.ownerPHID) {
          userPHIDs.add(data.task.fields.ownerPHID);
        }
        const subscriberPHIDs = data.task.attachments?.subscribers?.subscriberPHIDs || [];
        subscriberPHIDs.forEach((phid: string) => userPHIDs.add(phid));
        
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

          if (data.task.fields?.ownerPHID && newUserCache[data.task.fields.ownerPHID]) {
            const owner = newUserCache[data.task.fields.ownerPHID];
            setAssignee([{
              id: data.task.fields.ownerPHID,
              name: owner.realName || owner.userName,
              avatar: owner.realName?.charAt(0) || owner.userName?.charAt(0)
            }]);
          }

          const subscriberList = subscriberPHIDs.map((phid: string) => {
            const user = newUserCache[phid];
            return {
              id: phid,
              name: user?.realName || user?.userName || phid,
              avatar: user?.realName?.charAt(0) || user?.userName?.charAt(0)
            };
          }).filter((s: { id: string; name: string; avatar: string | undefined }) => s.name);
          setSubscribers(subscriberList);

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

  const loadAllSubtasksInBackground = async (rootSubtasks: Subtask[], abortController: AbortController) => {
    try {
      let totalLoaded = 0;
      setSubtasksLoadProgress(0);
      
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
      
      const loadLevel = async (tasksToLoad: Subtask[], level: number): Promise<Subtask[]> => {
        if (level > 5 || abortController.signal.aborted || tasksToLoad.length === 0) {
          return [];
        }
        
        const needsLoading = tasksToLoad.filter(t => t.hasChildren && t.children.length === 0);
        if (needsLoading.length === 0) return [];
        
        const taskIds = needsLoading.map(t => t.id);
        
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
        
        if (!abortController.signal.aborted) {
          setSubtasks(prev => updateMultipleTaskChildren(prev, updates));
          setSubtasksLoadProgress(totalLoaded);
        }
        
        return allChildren;
      };
      
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
    
    if (currentStatus === 'resolved' || currentStatus === 'excluded') {
      handleReopenSubtask(taskId, currentStatus);
      return;
    }
    
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
    const findAndToggle = async (tasks: Subtask[]): Promise<Subtask[]> => {
      const result: Subtask[] = [];
      for (const task of tasks) {
        if (task.id === taskId) {
          const newExpanded = !task.expanded;
          
          if (newExpanded && task.children.length === 0 && task.hasChildren) {
            try {
              const subtaskData = await httpClient<any>(`/api/tasks/${taskId}`);
              const children = subtaskData?.subtasks
                ?.filter((st: any) => st.fields?.status?.value !== 'invalid')
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

  const addSubtask = async (parentId: number | null) => {
    if (!newSubtaskTitle.trim() || !task) return;
    
    try {
      let parentPHID: string;
      if (parentId === null || parentId === 0) {
        parentPHID = task.phid;
      } else {
        const parentData = await httpClient<any>(`/api/tasks/${parentId}`);
        if (!parentData?.task?.phid) {
          throw new Error('Failed to get parent task PHID');
        }
        parentPHID = parentData.task.phid;
      }
      
      const response = await httpClient<any>('/api/tasks/create', {
        method: 'POST',
        body: {
          title: newSubtaskTitle,
          description: '',
          parentTask: parentPHID,
          projects: detailData?.task?.attachments?.projects?.projectPHIDs || []
        }
      });
      
      const createdTaskId = response?.object?.id;
      if (!createdTaskId) {
        throw new Error('Failed to get created task ID from response');
      }
      
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
        if (!task.completed) return true;
        if (task.children && task.children.length > 0) return true;
        return false;
      });
  };

  const refreshComments = async (taskId: number) => {
    try {
      const data = await httpClient<TaskDetailData>(`/api/tasks/${taskId}`);
      setDetailData(data);
      
      const commentTransactions = (data.transactions || [])
        .filter((t: any) => t.comments && t.comments.length > 0);
      
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-4xl h-[85vh] p-0 flex flex-col gap-0", contentZIndex)}>
        {/* Fixed Header */}
        <DialogHeader className="flex-shrink-0 border-b p-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">T{task.id}</span>
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
                        title: taskTitle,
                        taskId: task.id,
                      });
                    }
                  }}
                  className={cn(
                    "p-1.5 rounded-full transition-colors",
                    isPinned(`task-${task.id}`) 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={isPinned(`task-${task.id}`) ? '取消固定' : '固定'}
                >
                  {isPinned(`task-${task.id}`) ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRatingPanelOpen(true)}
                className={cn(
                  "h-8 gap-1.5 text-xs font-medium",
                  hasRating && "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                )}
              >
                <Award className="h-3.5 w-3.5" />
                {hasRating ? '修改评分' : '任务打分'}
              </Button>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            {isEditingTitle ? (
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                className="text-lg font-semibold h-auto py-1 px-2 -ml-2"
                autoFocus
              />
            ) : (
              <DialogTitle className="text-xl group flex items-start gap-2">
                {taskTitle}
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="mt-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </DialogTitle>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">状态</span>
                <Select
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
                          fields: { ...task.fields, status: { value, name: getTaskStatusName(value), color: task.fields.status.color } } 
                        };
                        onTaskUpdate(updatedTask);
                      }
                    } catch (error) {
                      toast.error('更新状态失败');
                    }
                  }}
                >
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_STATUS_NAMES).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">优先级</span>
                <Select
                  value={taskPriority}
                  onValueChange={async (value) => {
                    const priorityKeywordMap: Record<string, string> = {
                      '100': 'unbreak', '90': 'triage', '80': 'high', '50': 'normal', '25': 'low', '0': 'wish'
                    };
                    const priorityKeyword = priorityKeywordMap[value] || 'normal';
                    setTaskPriority(value);
                    try {
                      await httpClient('/api/tasks/edit', {
                        method: 'POST',
                        body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'priority', value: priorityKeyword }] }
                      });
                      toast.success('优先级已更新');
                    } catch (error) { toast.error('更新优先级失败'); }
                  }}
                >
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="选择优先级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100" className="text-xs">P1 紧急</SelectItem>
                    <SelectItem value="90" className="text-xs">P2 高</SelectItem>
                    <SelectItem value="80" className="text-xs">P3 中</SelectItem>
                    <SelectItem value="50" className="text-xs">P4 普通</SelectItem>
                    <SelectItem value="25" className="text-xs">P5 低</SelectItem>
                    <SelectItem value="0" className="text-xs">P6 微不足道</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">指派给</span>
                <div className="w-40 flex justify-end">
                  <PeoplePicker
                    selected={assignee}
                    onAdd={async (person) => {
                      setAssignee([person]);
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'owner', value: person.id }] }
                        });
                        toast.success(`已指派给: ${person.name}`);
                      } catch (error) { toast.error('指派失败'); }
                    }}
                    onRemove={async () => {
                      setAssignee([]);
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'owner', value: '' }] }
                        });
                        toast.success('已移除指派');
                      } catch (error) { toast.error('移除指派失败'); }
                    }}
                    maxSelections={1}
                    className="justify-end"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">工作量</span>
                <div className="w-40">
                  <Input
                    value={workload}
                    onChange={(e) => setWorkload(e.target.value)}
                    onBlur={async () => {
                      if (!workload.trim()) return;
                      // Simplified logic for brevity - assume formatted
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'custom.tp-link.estimated-days', value: workload }] }
                        });
                        toast.success('工作量已更新');
                      } catch (error) { toast.error('更新工作量失败'); }
                    }}
                    className="h-9 text-right"
                    placeholder="如: 1d"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">计划完成</span>
                <DatePicker
                  value={plannedCompletion}
                  onChange={async (date) => {
                    setPlannedCompletion(date);
                    try {
                      const timestamp = date ? Math.floor(date.getTime() / 1000) : null;
                      await httpClient('/api/tasks/edit', {
                        method: 'POST',
                        body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'custom.tp-link.estimated-date-complete', value: timestamp }] }
                      });
                      toast.success(date ? '计划完成时间已更新' : '已清除');
                    } catch (error) { toast.error('更新失败'); }
                  }}
                  className="w-40 justify-end"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">项目</span>
                <div className="w-40 flex justify-end">
                  <ProjectPicker
                    selected={projectTags}
                    onAdd={async (project) => {
                      setProjectTags([project]);
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'projects.add', value: [project.id] }] }
                        });
                        toast.success(`已设置项目: ${project.name}`);
                      } catch (error) { toast.error('设置项目失败'); }
                    }}
                    onRemove={async (projectId) => {
                      setProjectTags([]);
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'projects.remove', value: [projectId] }] }
                        });
                        toast.success('已移除项目标签');
                      } catch (error) { toast.error('移除项目失败'); }
                    }}
                    maxSelections={1}
                    className="justify-end"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <button
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform", isDetailsExpanded && "rotate-180")} />
              {isDetailsExpanded ? '收起更多详情' : '展开更多详情'}
            </button>
          </div>

          {isDetailsExpanded && (
            <div className="bg-muted/30 rounded-lg p-4 grid grid-cols-2 gap-x-8 gap-y-4 text-sm animate-in slide-in-from-top-2 fade-in">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">订阅者</span>
                <PeoplePicker
                  selected={subscribers}
                  onAdd={async (person) => {
                    setSubscribers([...subscribers, person]);
                    try {
                      await httpClient('/api/tasks/edit', {
                        method: 'POST',
                        body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'subscribers.add', value: [person.id] }] }
                      });
                      toast.success(`已添加订阅者: ${person.name}`);
                    } catch (error) { toast.error('添加失败'); }
                  }}
                  onRemove={async (personId) => {
                    setSubscribers(subscribers.filter(s => s.id !== personId));
                    try {
                      await httpClient('/api/tasks/edit', {
                        method: 'POST',
                        body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'subscribers.remove', value: [personId] }] }
                      });
                      toast.success('已移除订阅者');
                    } catch (error) { toast.error('移除失败'); }
                  }}
                  className="justify-end"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">更新计划</span>
                <DatePicker
                  value={updatedPlan}
                  onChange={async (date) => {
                    setUpdatedPlan(date);
                    try {
                      const timestamp = date ? Math.floor(date.getTime() / 1000) : null;
                      await httpClient('/api/tasks/edit', {
                        method: 'POST',
                        body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'custom.tp-link.update-date-complete', value: timestamp }] }
                      });
                      toast.success(date ? '更新计划已设置' : '已清除');
                    } catch (error) { toast.error('更新失败'); }
                  }}
                  className="justify-end"
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-muted-foreground" />
                描述
              </h3>
              {!isEditingDescription && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditingDescription(true)} className="h-7 text-xs">
                  <Edit2 className="h-3 w-3 mr-1.5" />
                  编辑
                </Button>
              )}
            </div>
            
            {isEditingDescription ? (
              <div className="space-y-3">
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="w-full min-h-[150px] p-3 text-sm rounded-md border border-input bg-transparent shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingDescription(false)}>取消</Button>
                  <Button 
                    size="sm" 
                    onClick={async () => {
                      setIsEditingDescription(false);
                      try {
                        await httpClient('/api/tasks/edit', {
                          method: 'POST',
                          body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'description', value: taskDescription }] }
                        });
                        toast.success('描述已更新');
                        if (onTaskUpdate) {
                          const updatedTask = { ...task, fields: { ...task.fields, description: { raw: taskDescription } } };
                          onTaskUpdate(updatedTask);
                        }
                      } catch (error) { toast.error('更新描述失败'); }
                    }}
                  >
                    保存
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-foreground/90 bg-muted/20 rounded-md p-4 min-h-[60px] border border-border/50">
                <RichContentRenderer content={taskDescription || '暂无描述'} />
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-muted-foreground" />
                子任务
                {isLoadingSubtasksBackground && (
                  <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 ml-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    加载中...
                  </span>
                )}
              </h3>
              {subtasks.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowCompletedSubtasks(!showCompletedSubtasks)}
                  className="h-7 text-xs"
                >
                  {showCompletedSubtasks ? '隐藏已完成' : '显示已完成'}
                </Button>
              )}
            </div>

            {isLoadingSubtasks ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner message="" size="md" />
              </div>
            ) : (
              <div className="space-y-3">
                {subtasks.length > 0 && (
                  <div className="space-y-1 pl-1">
                    {filterSubtasks(subtasks).map((task) => (
                      <SubtaskItem
                        key={task.id}
                        task={task}
                        level={0}
                        onToggle={toggleSubtask}
                        onExpand={toggleExpand}
                        onAddChild={setAddingSubtaskToId}
                        onDelete={deleteSubtask}
                        onClick={(subtask) => openSecondaryTask(subtask.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Add Subtask Input */}
                {addingSubtaskToId !== null ? (
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md animate-in fade-in zoom-in-95">
                    <Input
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
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button 
                      size="sm" 
                      className="h-8"
                      disabled={!newSubtaskTitle.trim()}
                      onClick={() => addSubtask(addingSubtaskToId === 0 ? null : addingSubtaskToId)}
                    >
                      添加
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8"
                      onClick={() => {
                        setAddingSubtaskToId(null);
                        setNewSubtaskTitle('');
                      }}
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-muted-foreground hover:text-foreground border-dashed"
                    onClick={() => setAddingSubtaskToId(0)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    添加子任务
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-3 pt-2">
            {isLoadingComments ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner message="" size="md" />
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
                    body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'comment', value: marker }] },
                  });
                  await refreshComments(task.id);
                  toast.success('评论已更新');
                }}
                onDelete={async (itemId: number | string) => {
                  if (!task) return;
                  const transactionPHID = String(itemId);
                  const marker = `[phabdash-delete:${transactionPHID}]\nThis comment has been deleted.`;
                  await httpClient('/api/tasks/edit', {
                    method: 'POST',
                    body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'comment', value: marker }] },
                  });
                  await refreshComments(task.id);
                }}
                onAdd={async (content: string) => {
                  if (!task) return;
                  await httpClient('/api/tasks/edit', {
                    method: 'POST',
                    body: { objectIdentifier: `T${task.id}`, transactions: [{ type: 'comment', value: content }] },
                  });
                  await refreshComments(task.id);
                  toast.success('评论已添加');
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>

      <TaskScoringDialog
        isOpen={isRatingPanelOpen}
        onClose={() => setIsRatingPanelOpen(false)}
        onConfirm={handleScoringConfirm}
        currentValues={taskScoring || undefined}
        isScored={hasRating}
        autoMappedWorkClass={(!hasRating && workload ? workload : undefined)}
      />

      {secondaryTask && (
        <TaskDetailDialog
          task={secondaryTask}
          open={true}
          onOpenChange={(open) => {
            if (!open) setSecondaryTask(null);
          }}
          onTaskUpdate={(updatedTask) => {
            setSecondaryTask(updatedTask);
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
    </Dialog>
  );
}
