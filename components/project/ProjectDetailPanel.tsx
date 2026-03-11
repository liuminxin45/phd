import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogTitle
} from '@/components/ui/dialog';
import { Info, BarChart, Kanban, FileText, Users, User, TrendingUp, MessageSquare, Send, Plus, Settings, Trash2, Filter, ChevronRight, GripVertical, Upload, ExternalLink, Edit2, Check, Loader2, Maximize2, Minimize2, Pin, X } from 'lucide-react';
import { Project } from '@/lib/api';
import { httpClient } from '@/lib/httpClient';
import { toast, toastWithUndo } from '@/lib/toast';
import { PeoplePicker } from '@/components/ui/people-picker';
import { Progress } from '@/components/ui/progress';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { NodePoolPicker } from '@/components/ui/node-pool-picker';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { usePinnedPanel } from '@/contexts/PinnedPanelContext';
import { RemarkupRenderer } from '@/components/ui/RemarkupRenderer';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { Timeline, TimelineItem } from '@/components/ui/Timeline';
import { cn } from '@/lib/utils';
import { GlassSearchInput } from '@/components/ui/glass-search-input';
import { glassInputClass, glassSectionClass, glassToolbarClass } from '@/components/ui/glass';

interface ProjectDetailPanelProps {
  project: Project;
  isModal?: boolean;
  onClose?: () => void;
}

type TabId = 'info' | 'dashboard' | 'kanban' | 'docs';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}

interface ProjectPerson {
  id: string;
  name: string;
  avatar?: string;
}

interface Milestone {
  id: number;
  milePHID?: string;
  monogram?: string;
  node: string;
  preNode: string;
  bindItem?: string; // Bind Node Pool Item
  originalPlan?: Date;
  updatedPlan?: Date;
  actualComplete?: Date;
  nodeDelay: string;
  totalDelay: string;
  delayCount: string;
  delayCategory: string;
  taskId: string;
  processNode: string;
}

 type NodePoolItemAllSearchItem = {
   id: number;
   type: string;
   phid: string;
   fields: {
     itemName: string;
     statisticsRequired?: string;
     dateCreated?: number;
     dateModified?: number;
   };
 };

interface ProgressUpdate {
  id: number;
  author: string;
  content: string;
  timestamp: string;
}

interface KanbanTask {
  id: string;
  taskId: number;
  title: string;
  status: 'Waiting' | 'In Progress' | 'Completed';
  assignee: string;
}

// Tab Item Component with Drag & Drop
const TabItem = ({ tab, index, moveTab, onClick }: any) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'TAB',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'TAB',
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        moveTab(item.index, index);
        item.index = index;
      }
    },
  });

  const ref = (node: HTMLButtonElement | null) => {
    drag(node);
    drop(node);
  };

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`group flex h-9 items-center rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 cursor-move ${
        tab.active
          ? 'border-sky-200/90 bg-sky-50/82 text-sky-700 shadow-[0_8px_20px_rgba(14,116,144,0.14)]'
          : 'border-white/55 bg-white/68 text-slate-600 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/82 hover:text-slate-900'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <tab.icon className={cn("h-4 w-4 transition-transform duration-200", tab.active ? "" : "group-hover:scale-105")} />
        {tab.label}
      </div>
    </button>
  );
};

// Milestone Item Component
const MilestoneItem = ({ milestone, index, moveMilestone, onDelete, onUpdate, onEdit, visibleFields }: any) => {
  const [{ isDragging }, drag, preview] = useDrag({
    type: 'MILESTONE',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'MILESTONE',
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        moveMilestone(item.index, index);
        item.index = index;
      }
    },
  });

  const ref = (node: HTMLDivElement | null) => {
    preview(node);
    drop(node);
  };

  const dragRef = (node: HTMLDivElement | null) => {
    drag(node);
    return undefined;
  };

  // Determine background color and text style based on milestone status (processNode)
  const getStatusStyles = () => {
    switch (milestone.processNode) {
      case 'Completed':
        // Completed: faded/grayed out style to reduce visual prominence
        return {
          container: 'bg-neutral-100 border-neutral-200 opacity-60',
          text: 'text-neutral-400'
        };
      case 'In Progress':
        return {
          container: 'bg-blue-50 border-blue-200',
          text: 'text-neutral-900'
        };
      case 'Not Started':
      default:
        return {
          container: 'bg-neutral-50 border-neutral-200',
          text: 'text-neutral-600'
        };
    }
  };

  const statusStyles = getStatusStyles();

  return (
    <div
      ref={ref}
      className={cn(
        `${statusStyles.container} border rounded-2xl p-2.5 transition-all duration-200 group w-fit`,
        "border-white/60 bg-white/62 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/48",
        "hover:-translate-y-0.5 hover:border-sky-200/70",
        isDragging ? 'opacity-50' : ''
      )}
    >
      <div className="grid gap-2 text-[10px] items-center" style={{
        gridTemplateColumns: `40px ${visibleFields.node ? '120px' : ''} ${visibleFields.preNode ? '100px' : ''} ${visibleFields.originalPlan ? '100px' : ''} ${visibleFields.updatedPlan ? '100px' : ''} ${visibleFields.actualComplete ? '100px' : ''} ${visibleFields.nodeDelay ? '80px' : ''} ${visibleFields.totalDelay ? '80px' : ''} ${visibleFields.delayCount ? '70px' : ''} ${visibleFields.delayCategory ? '80px' : ''} ${visibleFields.taskId ? '80px' : ''} ${visibleFields.processNode ? '90px' : ''} 50px`.replace(/\s+/g, ' ').trim()
      }}>
        <div ref={dragRef} className="flex items-center justify-center cursor-move">
          <GripVertical className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600" />
        </div>
        {visibleFields.node && (
          <button
            onClick={() => onEdit(milestone)}
            className={`truncate text-left hover:text-blue-600 transition-colors ${statusStyles.text}`}
            title={milestone.node}
          >
            <span className="text-[11px]">{milestone.node}</span>
          </button>
        )}
        {visibleFields.preNode && <div className={`${statusStyles.text} truncate`} title={milestone.preNode}>{milestone.preNode}</div>}
        {visibleFields.originalPlan && <div className={`${statusStyles.text} truncate`}>{milestone.originalPlan ? milestone.originalPlan.toLocaleDateString('zh-CN') : '-'}</div>}
        {visibleFields.updatedPlan && <div className={`${statusStyles.text} truncate`}>{milestone.updatedPlan ? milestone.updatedPlan.toLocaleDateString('zh-CN') : '-'}</div>}
        {visibleFields.actualComplete && <div className={`${statusStyles.text} truncate`}>{milestone.actualComplete ? milestone.actualComplete.toLocaleDateString('zh-CN') : '-'}</div>}
        {visibleFields.nodeDelay && <div className={`${statusStyles.text} truncate`} title={milestone.nodeDelay}>{milestone.nodeDelay}</div>}
        {visibleFields.totalDelay && <div className={`${statusStyles.text} truncate`} title={milestone.totalDelay}>{milestone.totalDelay}</div>}
        {visibleFields.delayCount && <div className={`${statusStyles.text} truncate`} title={milestone.delayCount}>{milestone.delayCount}</div>}
        {visibleFields.delayCategory && <div className={`${statusStyles.text} truncate`} title={milestone.delayCategory}>{milestone.delayCategory}</div>}
        {/* taskId and processNode fields are hidden - functionality not implemented yet
        {visibleFields.taskId && <div className="text-neutral-600 truncate" title={milestone.taskId}>{milestone.taskId}</div>}
        {visibleFields.processNode && <div className="text-neutral-600 truncate" title={milestone.processNode}>{milestone.processNode}</div>}
        */}
        <button
          onClick={() => onDelete(milestone.id)}
          className="rounded-lg border border-transparent p-1 transition-all hover:border-rose-200/70 hover:bg-rose-50"
          title="删除里程碑"
        >
          <Trash2 className="h-3 w-3 text-red-500" />
        </button>
      </div>
    </div>
  );
};

// Helper function to calculate milestone status based on actualComplete field and preNode dependency
// Status logic:
// - If actualComplete has a date -> "Completed"
// - The milestone whose preNode is a completed milestone (and itself is not completed) -> "In Progress"
// - All other milestones without actualComplete -> "Not Started"
const calculateMilestoneStatus = (milestones: Milestone[]): Milestone[] => {
  // First, find all completed milestone names
  const completedMilestoneNames = new Set(
    milestones
      .filter(m => m.actualComplete)
      .map(m => m.node)
  );

  // If no completed milestones, the first milestone (or one with no preNode) is "In Progress"
  if (completedMilestoneNames.size === 0) {
    let foundFirst = false;
    return milestones.map((milestone) => {
      if (!foundFirst && (milestone.preNode === '-' || milestone.preNode === '')) {
        foundFirst = true;
        return { ...milestone, processNode: 'In Progress' };
      }
      return { ...milestone, processNode: foundFirst ? 'Not Started' : 'In Progress' };
    });
  }

  // Find milestones that are "In Progress":
  // - Not completed (no actualComplete)
  // - Their preNode is a completed milestone
  return milestones.map((milestone) => {
    let status: string;

    if (milestone.actualComplete) {
      // Has actual completion date = completed
      status = 'Completed';
    } else if (milestone.preNode && milestone.preNode !== '-' && completedMilestoneNames.has(milestone.preNode)) {
      // This milestone's preNode is completed, so this one is in progress
      status = 'In Progress';
    } else if (milestone.preNode === '-' || milestone.preNode === '') {
      // No preNode - check if it should be in progress (first milestone scenario)
      status = completedMilestoneNames.size === 0 ? 'In Progress' : 'Not Started';
    } else {
      // preNode is not completed yet = not started
      status = 'Not Started';
    }

    return { ...milestone, processNode: status };
  });
};

// Helper function to get delay reason options based on team
const getDelayReasonOptions = (team: string): { value: string; label: string }[] => {
  const reasonMap: Record<string, string[]> = {
    '产品': ['需求变更', '优先级变更', 'UE/UI', '其它'],
    '软件': ['开发质量问题', '预期外BUG', 'BUG跟进耗时', '供应商跟进', '自测拓扑难以搭建', '部门联调问题', '预估偏差', '人力紧缺', '样机缺乏', '投入其它更高优先级任务', '其它'],
    '硬件': ['测试bug跟进', 'FPGA问题', '物料问题', '部门联调问题', '硬件设计问题', '预估偏差', '优先级', '人力紧缺', '其它'],
    '测试': ['提测质量-样机问题', '提测质量-bug', '提测质量-改动评估', '提测质量-规范及自测问题', '测试开发问题', '测试规划问题', '测试执行问题', '测试资源-拓扑', '测试资源-人力', '其它'],
    '结构': ['ID外观问题', '结构设计问题', '声光热力电学设计及仿真问题', '模具设计及加工问题', '壳体外观及结构等问题', '结构物料打样及评估问题', '结构相关产前验证问题', '包装问题', '安规认证问题', '人力紧缺', '其它'],
    'ISP': ['软件交接', '硬件交接', '调试质量问题', '调试预期外问题', '物料问题', '人力紧缺', '其它'],
    '算法': ['功能bug未收敛', '性能bug未收敛', '供应商相关', '预估偏差', '优先级', '人力紧缺', '其它'],
    '采购': ['备料延期', '优先级', '人力紧缺', '寻样困难', '打样回样慢', '其他'],
    '生产': ['PMC排单延期', '需求问题', '其它', '光明厂/板厂'],
    'CAD': ['部门联调问题', '人力紧缺', '优先级', '预估偏差', 'CAD修改调整', '其它'],
    '其它': ['外部送测'],
    '历史存档': ['软件', 'ISP', '硬件', '结构', '测试', '预估偏差', '需求变更', '优先级', '物料供应', '物料性能', '人力紧缺', '其他', '板厂', '光明厂', 'UE/UI', '需求发布', '算法', 'CAD']
  };

  const reasons = reasonMap[team] || [];
  return [
    { value: '', label: 'Please select' },
    ...reasons.map(r => ({ value: r, label: r }))
  ];
};

export function ProjectDetailPanel({ project, isModal = false, onClose }: ProjectDetailPanelProps) {
  const { addPinnedItem, removePinnedItem, isPinned } = usePinnedPanel();
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'info', label: 'Project Info', icon: Info, active: true },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart, active: false },
    { id: 'kanban', label: 'Task Board', icon: Kanban, active: false },
    { id: 'docs', label: 'Docs', icon: FileText, active: false },
  ]);

  // Project data state
  const [loading, setLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectPerson[]>([]);
  const [projectManager, setProjectManager] = useState<ProjectPerson[]>([]);
  const [productManager, setProductManager] = useState<ProjectPerson[]>([]);
  const [projectAssistant, setProjectAssistant] = useState<ProjectPerson[]>([]);
  const [projectProgress, setProjectProgress] = useState(0);

  // Dashboard tab state
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showMilestoneFieldSettings, setShowMilestoneFieldSettings] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false); // true = adding new milestone, false = editing existing
  const [nodePoolItems, setNodePoolItems] = useState<NodePoolItemAllSearchItem[]>([]);
  const [isLoadingNodePoolItems, setIsLoadingNodePoolItems] = useState(false);
  const [isLoadingMilestones, setIsLoadingMilestones] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [delayTeam, setDelayTeam] = useState<string>('');
  const [delayReason, setDelayReason] = useState<string>('');
  const [delayDesc, setDelayDesc] = useState<string>(''); // Delay Reason描述
  const [milestoneVisibleFields, setMilestoneVisibleFields] = useState({
    node: true,
    preNode: true,
    originalPlan: true,
    updatedPlan: true,
    actualComplete: true,
    nodeDelay: false,
    totalDelay: false,
    delayCount: false,
    delayCategory: false,
    // taskId and processNode fields are hidden - functionality not implemented yet
    taskId: false,
    processNode: false,
  });
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [newProgressUpdate, setNewProgressUpdate] = useState('');
  const [scheduleMonogram, setScheduleMonogram] = useState<string>('');
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Kanban tab state
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>([]);
  const [kanbanMemberFilter, setKanbanMemberFilter] = useState<string[]>([]);
  const [kanbanStatusFilter, setKanbanStatusFilter] = useState<string>('All');
  const [kanbanSearchQuery, setKanbanSearchQuery] = useState('');
  const [collapsedColumns, setCollapsedColumns] = useState<{ [key: string]: boolean }>({
    waiting: false,
    inProgress: false,
    completed: false,
  });
  const [isAddingKanbanTask, setIsAddingKanbanTask] = useState(false);
  const [newKanbanTaskTitle, setNewKanbanTaskTitle] = useState('');

  // Docs tab state
  const [projectDocs, setProjectDocs] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocLink, setNewDocLink] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [editingDocContent, setEditingDocContent] = useState('');
  const [selectedTaskForDialog, setSelectedTaskForDialog] = useState<any | null>(null);

  // Fetch project details
  useEffect(() => {
    const fetchProjectDetails = async () => {
      setLoading(true);
      try {
        const data = await httpClient<{ data: Project[] }>(`/api/projects/${project.id}`);
        if (data.data && data.data.length > 0) {
          const projectData = data.data[0];
          const fields = (projectData as any).fields || {};

          // Extract members from attachments
          const membersData = (projectData as any).attachments?.members?.members || [];
          const memberPHIDs = membersData.map((m: any) => typeof m === 'string' ? m : m.phid).filter(Boolean);

          // Collect all PHIDs that need user info
          const customFieldPHIDs = [
            fields.projectManagerPHID,
            fields.productManagerPHID,
            fields.assistantPHID,
            ...(fields.developersPHID || [])
          ].filter(Boolean);

          let allPHIDsToFetch = [...new Set([...memberPHIDs, ...customFieldPHIDs])].filter(p => typeof p === 'string');
          const cache: Record<string, any> = {};

          // Load role assignments from schedule system
          try {
            const roleResp = await httpClient<any>(`/api/projects/${project.id}/roles`);
            const roles = roleResp?.roles || {};
            const users = roleResp?.users || {};

            // Set role PHIDs
            if (roles.projectManagerPHID) {
              const user = users[roles.projectManagerPHID];
              if (user) {
                setProjectManager([{ id: roles.projectManagerPHID, name: user.realName || user.userName, avatar: user.image }]);
              }
            }
            if (roles.productManagerPHID) {
              const user = users[roles.productManagerPHID];
              if (user) {
                setProductManager([{ id: roles.productManagerPHID, name: user.realName || user.userName, avatar: user.image }]);
              }
            }
            if (roles.assistantPHID) {
              const user = users[roles.assistantPHID];
              if (user) {
                setProjectAssistant([{ id: roles.assistantPHID, name: user.realName || user.userName, avatar: user.image }]);
              }
            }

            Object.entries(users).forEach(([phid, userData]: any) => {
              if (userData) {
                cache[phid] = {
                  phid,
                  realName: userData.realName || '',
                  userName: userData.userName || '',
                  image: userData.image || null,
                };
              }
            });

            const rolePHIDs: string[] = [
              roles.projectManagerPHID,
              roles.productManagerPHID,
              roles.assistantPHID,
              ...(Array.isArray(roles.developersPHID) ? roles.developersPHID : [])
            ].filter((p: any) => typeof p === 'string' && p.startsWith('PHID-USER-'));
            allPHIDsToFetch = [...new Set([...allPHIDsToFetch, ...rolePHIDs])];
          } catch (e) {
            // Fallback to project fields if role fetch fails
          }

          // Load missing users for members
          if (allPHIDsToFetch.length > 0) {
            const usersData = await httpClient<Record<string, any>>('/api/users/batch', {
              method: 'POST',
              body: { phids: allPHIDsToFetch }
            });

            Object.entries(usersData).forEach(([phid, userData]) => {
              if (userData) {
                cache[phid] = {
                  phid,
                  realName: userData.realName || '',
                  userName: userData.userName || '',
                  image: userData.image || null
                };
              }
            });
          }

          // Set members list
          const membersList = memberPHIDs.map((phid: string) => {
            const user = cache[phid];
            return {
              id: phid,
              name: user?.realName || user?.userName || 'Unknown',
              avatar: user?.image || ''
            };
          });
          setProjectMembers(membersList);
        }
      } catch (error) {
        console.error('Failed to fetch project details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectDetails();
  }, [project.id]);

  // Fetch project progress and milestones
  useEffect(() => {
    const fetchProgress = async () => {
      setIsLoadingMilestones(true);
      try {
        const progressData = await httpClient<any>(`/api/projects/${project.id}/progress`);
        setProjectProgress(progressData.progressPercentage || 0);

        // Fetch milestones data
        const milestonesData = await httpClient<any>(`/api/projects/${project.id}/milestones`);
        if (milestonesData && Array.isArray(milestonesData)) {
          const formattedMilestones = milestonesData.map((m: any, index: number) => ({
            id: index + 1,
            milePHID: m.milePHID,
            monogram: m.monogram,
            node: m.milestoneName || m.node || '-',
            preNode: m.preMilestone || m.preNode || '-',
            bindItem: m.bindItem || '', // Bind Node Pool Item
            originalPlan: m.estimateFinishDate ? new Date(m.estimateFinishDate * 1000) : undefined,
            updatedPlan: m.updateFinishDate ? new Date(m.updateFinishDate * 1000) : undefined,
            actualComplete: m.actualFinishDate ? new Date(m.actualFinishDate * 1000) : undefined,
            nodeDelay: m.delayDays ? `${m.delayDays}天` : '0天',
            totalDelay: m.totalDelayDays ? `${m.totalDelayDays}天` : '0天',
            delayCount: m.delayNum ? String(m.delayNum) : '0',
            delayCategory: m.delayType || '-',
            taskId: m.monogram || '-',
            processNode: m.status || 'Not Started',
          }));
          // Calculate status based on actualComplete field
          const milestonesWithStatus = calculateMilestoneStatus(formattedMilestones);
          setMilestones(milestonesWithStatus);
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      } finally {
        setIsLoadingMilestones(false);
      }
    };

    fetchProgress();
  }, [project.id]);

  useEffect(() => {
    const fetchNodePoolItems = async () => {
      if (!isEditPanelOpen) return;
      if (nodePoolItems.length > 0) return;

      setIsLoadingNodePoolItems(true);
      try {
        const res = await httpClient<any>('/api/conduit', {
          method: 'POST',
          body: {
            method: 'pool.iteam.all.search',
            params: {
              queryKey: 'all',
              constraints: {},
              order: 'newest',
              limit: 100,
            },
          },
        });

        if (res?.data && Array.isArray(res.data)) {
          setNodePoolItems(res.data);
        }
      } catch (e) {
        // ignore
      } finally {
        setIsLoadingNodePoolItems(false);
      }
    };

    fetchNodePoolItems();
  }, [isEditPanelOpen, nodePoolItems.length]);

  useEffect(() => {
    if (!isEditPanelOpen) return;
    if (!editingMilestone) return;
    if (nodePoolItems.length === 0) return;

    const current = editingMilestone.bindItem || '';
    if (!current) return;
    if (current.startsWith('PHID-IALL-')) return;

    const match = nodePoolItems.find(i => i.fields?.itemName === current);
    if (!match) return;

    setEditingMilestone(prev => {
      if (!prev) return prev;
      if ((prev.bindItem || '') === match.phid) return prev;
      return { ...prev, bindItem: match.phid };
    });
  }, [isEditPanelOpen, editingMilestone?.id, nodePoolItems]);

  // Fetch kanban tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tasksData = await httpClient<any>(`/api/projects/${project.id}/tasks`);
        if (tasksData && tasksData.data) {
          const tasks = tasksData.data;

          // Fetch owner info for all tasks
          const ownerPHIDs = tasks
            .map((t: any) => t.fields?.ownerPHID)
            .filter(Boolean);

          let ownerMap: Record<string, string> = {};
          if (ownerPHIDs.length > 0) {
            const usersData = await httpClient<Record<string, any>>('/api/users/batch', {
              method: 'POST',
              body: { phids: ownerPHIDs }
            });
            ownerMap = Object.fromEntries(
              Object.entries(usersData).map(([phid, user]) => [
                phid,
                user.realName || user.userName || 'Unknown'
              ])
            );
          }

          // Categorize tasks by status (exclude 'invalid' = 删除/中止)
          const formattedTasks: KanbanTask[] = tasks
            .filter((task: any) => {
              const status = task.fields?.status?.value || 'open';
              return status !== 'invalid'; // 排除"删除/中止"状态
            })
            .map((task: any) => {
              const status = task.fields?.status?.value || 'open';
              const ownerPHID = task.fields?.ownerPHID;
              const assignee = ownerPHID ? (ownerMap[ownerPHID] || 'Unknown') : '未分配';

              let kanbanStatus: 'Waiting' | 'In Progress' | 'Completed';
              // Waiting: notbegin(Not Started) + spite(暂停)
              if (status === 'notbegin' || status === 'spite') {
                kanbanStatus = 'Waiting';
              }
              // Completed: resolved(Completed) + excluded(Completed不加入统计)
              else if (status === 'resolved' || status === 'excluded') {
                kanbanStatus = 'Completed';
              }
              // In Progress: open(In Progress) + wontfix(In Progress不加入统计) + stalled等其他状态
              else {
                kanbanStatus = 'In Progress';
              }

              return {
                id: `T${task.id}`,
                taskId: task.id,
                title: task.fields?.name || 'Untitled',
                assignee,
                status: kanbanStatus,
              };
            });

          setKanbanTasks(formattedTasks);
        }
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      }
    };

    fetchTasks();
  }, [project.id]);

  // Fetch project comments and schedule monogram
  useEffect(() => {
    const fetchComments = async () => {
      setIsLoadingTimeline(true);
      try {
        // 使用带时间戳的 URL 避免缓存
        const timestamp = Date.now();
        const response = await fetch(`/api/projects/${project.id}/comments?_t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        const monogram = response.headers.get('X-Schedule-Monogram');
        if (monogram && monogram !== 'none') {
          setScheduleMonogram(monogram);
          // Extract schedule ID from monogram (e.g., "S8054" -> 8054)
          const idMatch = monogram.match(/\d+/);
          if (idMatch) {
            setScheduleId(parseInt(idMatch[0], 10));
          }
        }

        const commentsData = await response.json();

        if (Array.isArray(commentsData) && commentsData.length > 0) {
          const formattedUpdates = commentsData.map((c: any) => ({
            id: c.id,
            author: c.author || '未知用户',
            content: c.content,
            timestamp: c.timestamp,
          }));
          setProgressUpdates(formattedUpdates);
        }
      } catch (error) {
        console.error('Failed to fetch project comments:', error);
      } finally {
        setIsLoadingTimeline(false);
      }
    };

    fetchComments();
  }, [project.id]);

  const handleTabClick = (tabId: TabId) => {
    setTabs((tabs) =>
      tabs.map((tab) => ({ ...tab, active: tab.id === tabId }))
    );
  };

  const moveTab = (fromIndex: number, toIndex: number) => {
    const updatedTabs = [...tabs];
    const [movedTab] = updatedTabs.splice(fromIndex, 1);
    updatedTabs.splice(toIndex, 0, movedTab);
    setTabs(updatedTabs);
  };

  const activeTab = tabs.find(t => t.active);
  const projectPinId = `project-${project.id}`;
  const isProjectPinned = isPinned(projectPinId);

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-br from-white/35 via-sky-50/22 to-blue-50/18 text-foreground">
      {/* Header */}
      <div className={cn(glassToolbarClass, "m-3 flex flex-shrink-0 items-center justify-between rounded-2xl border border-white/60 px-4 py-3.5 md:px-5")}>
        <h2 className="truncate pr-3 text-lg font-semibold text-slate-900">{project.fields.name}</h2>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (isProjectPinned) {
                removePinnedItem(projectPinId);
              } else {
                addPinnedItem({
                  id: projectPinId,
                  type: 'project',
                  title: project.fields.name,
                  projectId: project.id,
                });
              }
            }}
            aria-label={isProjectPinned ? 'Unpin project' : 'Pin project'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-200 ${
              isProjectPinned
                ? 'border-sky-200/90 bg-sky-50/82 text-sky-700 shadow-[0_8px_20px_rgba(14,116,144,0.14)]'
                : 'border-white/55 bg-white/68 text-slate-600 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/82 hover:text-slate-900'
            }`}
            title={isProjectPinned ? 'Unpin from panel' : 'Pin to panel'}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
          {isModal && onClose && (
            <button
              onClick={onClose}
              aria-label="Close project details"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/55 bg-white/72 text-slate-600 shadow-[0_8px_20px_rgba(15,23,42,0.1)] backdrop-blur-lg supports-[backdrop-filter]:bg-white/58 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/90 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/55"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Draggable Tabs */}
      <DndProvider backend={HTML5Backend}>
        <div className="mx-3 mb-2 flex flex-shrink-0 gap-2 overflow-x-auto rounded-2xl border border-white/58 bg-white/48 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/36">
          {tabs.map((tab, index) => (
            <TabItem
              tab={tab}
              index={index}
              moveTab={moveTab}
              onClick={() => handleTabClick(tab.id)}
            />
          ))}
        </div>
      </DndProvider>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1 md:px-6">
        {/* Info Tab */}
        {activeTab?.id === 'info' && (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className={cn(glassSectionClass, "space-y-4 rounded-2xl border border-white/60 bg-white/62 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50")}>
              <h3 className="text-sm font-semibold text-slate-900">基本信息</h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-start">
                  <span className="w-24 flex-shrink-0 text-muted-foreground">Project Name:</span>
                  <span className="font-medium text-slate-800">{project.fields.name}</span>
                </div>
                <div className="flex items-start">
                  <span className="w-24 flex-shrink-0 text-muted-foreground">Description:</span>
                  <span className="text-muted-foreground text-xs">
                    {project.fields.description || 'No description'}
                  </span>
                </div>
              </div>
            </div>

            {/* Team Info */}
            <div className={cn(glassSectionClass, "space-y-4 rounded-2xl border border-white/60 bg-white/62 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50")}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="h-4 w-4" />
                Team Info
              </h3>

              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <User className="h-3 w-3 text-neutral-400 flex-shrink-0 mt-0.5" />
                  <span className="text-neutral-500 w-20 flex-shrink-0 text-xs">Project Manager:</span>
                  {loading ? (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    <PeoplePicker
                      selected={projectManager}
                      onAdd={(person) => {
                        setProjectManager([person]);
                        toast.success(`已设置Project Manager: ${person.name}`);
                      }}
                      onRemove={() => {
                        setProjectManager([]);
                        toast.success('Project manager removed');
                      }}
                      maxSelections={1}
                      className="w-full"
                      triggerClassName="min-h-[36px] rounded-xl border border-white/55 bg-white/72 px-3 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg transition-all hover:border-sky-200/80 hover:bg-white/90"
                    />
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <User className="h-3 w-3 text-neutral-400 flex-shrink-0 mt-0.5" />
                  <span className="text-neutral-500 w-20 flex-shrink-0 text-xs">Product Manager:</span>
                  {loading ? (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    <PeoplePicker
                      selected={productManager}
                      onAdd={(person) => {
                        setProductManager([person]);
                        toast.success(`已设置Product Manager: ${person.name}`);
                      }}
                      onRemove={() => {
                        setProductManager([]);
                        toast.success('Product manager removed');
                      }}
                      maxSelections={1}
                      className="w-full"
                      triggerClassName="min-h-[36px] rounded-xl border border-white/55 bg-white/72 px-3 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg transition-all hover:border-sky-200/80 hover:bg-white/90"
                    />
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <Users className="h-3 w-3 text-neutral-400 flex-shrink-0 mt-0.5" />
                  <span className="text-neutral-500 w-20 flex-shrink-0 text-xs">Assistant:</span>
                  {loading ? (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    <PeoplePicker
                      selected={projectAssistant}
                      onAdd={(person) => {
                        setProjectAssistant([...projectAssistant, person]);
                        toast.success(`Assistant added: ${person.name}`);
                      }}
                      onRemove={(personId) => {
                        setProjectAssistant(projectAssistant.filter(p => p.id !== personId));
                        toast.success('Assistant removed');
                      }}
                      maxSelections={1}
                      className="w-full"
                      triggerClassName="min-h-[36px] rounded-xl border border-white/55 bg-white/72 px-3 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg transition-all hover:border-sky-200/80 hover:bg-white/90"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Members */}
            <div className={cn(glassSectionClass, "space-y-3 rounded-2xl border border-white/60 bg-white/62 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50")}>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="h-4 w-4" />
                Members
              </h4>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading members...
                </div>
              ) : (
                <PeoplePicker
                  selected={projectMembers}
                  onAdd={(person) => {
                    setProjectMembers([...projectMembers, person]);
                    toast.success(`已AddMembers: ${person.name}`);
                  }}
                  onRemove={(personId) => {
                    setProjectMembers(projectMembers.filter(p => p.id !== personId));
                    toast.success('已移除Members');
                  }}
                  className="w-full"
                  triggerClassName="min-h-[40px] rounded-xl border border-white/55 bg-white/72 px-3 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg transition-all hover:border-sky-200/80 hover:bg-white/90"
                />
              )}
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab?.id === 'dashboard' && (
          <div className="space-y-4">
            {/* Progress Section */}
            <div className={cn(glassSectionClass, "rounded-2xl border border-white/60 bg-white/62 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50")}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <TrendingUp className="h-4 w-4" />
                  Progress
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowMilestoneFieldSettings(!showMilestoneFieldSettings)}
                    className="flex items-center gap-1 rounded-xl border border-white/55 bg-white/72 px-3 py-1.5 text-xs text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg transition-all hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/90"
                  >
                    <Settings className="h-3 w-3" />
                    Field Settings
                  </button>
                  <button
                    onClick={() => {
                      // Create a new empty milestone for adding
                      const newMilestone: Milestone = {
                        id: Math.max(0, ...milestones.map(m => m.id)) + 1,
                        node: '',
                        preNode: '-',
                        bindItem: '',
                        nodeDelay: '0天',
                        totalDelay: '0天',
                        delayCount: '0',
                        delayCategory: '-',
                        taskId: '-',
                        processNode: 'Not Started',
                      };
                      setEditingMilestone(newMilestone);
                      setIsAddMode(true);
                      setDelayTeam('');
                      setDelayReason('');
                      setDelayDesc('');
                      setIsEditPanelOpen(true);
                    }}
                    className="flex items-center gap-1 rounded-xl border border-sky-300/75 bg-sky-500 px-3 py-1.5 text-xs text-white shadow-[0_10px_22px_rgba(14,116,144,0.24)] transition-all hover:-translate-y-0.5 hover:bg-sky-600"
                  >
                    <Plus className="h-3 w-3" />
                    Create Milestone
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-end text-sm mb-2">
                    <span className="font-semibold text-neutral-900">{projectProgress}%</span>
                  </div>
                  <Progress value={projectProgress} className="h-2" />
                </div>

                {/* Field Visibility Settings */}
                {showMilestoneFieldSettings && (
                  <div className="rounded-2xl border border-sky-200/70 bg-sky-50/72 p-3 shadow-[0_10px_24px_rgba(14,116,144,0.12)] backdrop-blur-lg supports-[backdrop-filter]:bg-sky-50/58">
                    <h4 className="text-xs font-semibold text-neutral-900 mb-2">Field Visibility</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries({
                        node: 'Node',
                        preNode: 'Predecessor',
                        originalPlan: 'Original Plan',
                        updatedPlan: 'Updated Plan',
                        actualComplete: 'Actual Completion',
                        nodeDelay: 'Node Delay',
                        totalDelay: 'Total Delay',
                        delayCount: 'Delay Count',
                        delayCategory: 'Delay Category',
                        // taskId and processNode fields are hidden - functionality not implemented yet
                        // taskId: '任务编号',
                        // processNode: 'Process Node',
                      }).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={milestoneVisibleFields[key as keyof typeof milestoneVisibleFields]}
                            onChange={(e) => {
                              setMilestoneVisibleFields({
                                ...milestoneVisibleFields,
                                [key]: e.target.checked,
                              });
                            }}
                            className="w-3 h-3"
                          />
                          <span className="text-neutral-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Old inline Add Milestone Input removed - now using shared edit panel */}

                {/* Milestones List */}
                {isLoadingMilestones ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-neutral-500 py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading milestones...
                  </div>
                ) : milestones.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="space-y-2">
                      {/* Milestone Table Header */}
                      <div className="mb-2 w-fit rounded-2xl border border-white/60 bg-white/72 p-2 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg supports-[backdrop-filter]:bg-white/58">
                        <div className="grid gap-2 text-[10px] font-medium text-neutral-600" style={{
                          gridTemplateColumns: `40px ${milestoneVisibleFields.node ? '120px' : ''} ${milestoneVisibleFields.preNode ? '100px' : ''} ${milestoneVisibleFields.originalPlan ? '100px' : ''} ${milestoneVisibleFields.updatedPlan ? '100px' : ''} ${milestoneVisibleFields.actualComplete ? '100px' : ''} ${milestoneVisibleFields.nodeDelay ? '80px' : ''} ${milestoneVisibleFields.totalDelay ? '80px' : ''} ${milestoneVisibleFields.delayCount ? '70px' : ''} ${milestoneVisibleFields.delayCategory ? '80px' : ''} ${milestoneVisibleFields.taskId ? '80px' : ''} ${milestoneVisibleFields.processNode ? '90px' : ''} 50px`.replace(/\s+/g, ' ').trim()
                        }}>
                          <div></div>
                          {milestoneVisibleFields.node && <div className="truncate">Node</div>}
                          {milestoneVisibleFields.preNode && <div className="truncate">Predecessor</div>}
                          {milestoneVisibleFields.originalPlan && <div className="truncate">Original Plan</div>}
                          {milestoneVisibleFields.updatedPlan && <div className="truncate">Updated Plan</div>}
                          {milestoneVisibleFields.actualComplete && <div className="truncate">Actual Completion</div>}
                          {milestoneVisibleFields.nodeDelay && <div className="truncate">Node延期</div>}
                          {milestoneVisibleFields.totalDelay && <div className="truncate">Total Delay</div>}
                          {milestoneVisibleFields.delayCount && <div className="truncate">Delay Count</div>}
                          {milestoneVisibleFields.delayCategory && <div className="truncate">Delay Category</div>}
                          {/* taskId and processNode fields are hidden - functionality not implemented yet
                          {milestoneVisibleFields.taskId && <div className="truncate">任务编号</div>}
                          {milestoneVisibleFields.processNode && <div className="truncate">Process Node</div>}
                          */}
                          <div className="text-center truncate">Action</div>
                        </div>
                      </div>
                      <DndProvider backend={HTML5Backend}>
                        {milestones.map((milestone, index) => (
                          <MilestoneItem
                            key={milestone.id}
                            milestone={milestone}
                            index={index}
                            visibleFields={milestoneVisibleFields}
                            moveMilestone={async (fromIndex: number, toIndex: number) => {
                              const updatedMilestones = [...milestones];
                              const [moved] = updatedMilestones.splice(fromIndex, 1);
                              updatedMilestones.splice(toIndex, 0, moved);
                              setMilestones(updatedMilestones);

                              // POST reorder to backend
                              if (scheduleId) {
                                try {
                                  const milestonePhids = updatedMilestones
                                    .map(m => m.milePHID)
                                    .filter(Boolean) as string[];

                                  const response = await fetch('/api/projects/reorder-milestones', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      scheduleId,
                                      milestonePhids,
                                    }),
                                  });

                                  const result = await response.json();
                                  if (!result.success) {
                                    console.error('Failed to reorder milestones:', result.error);
                                    toast.error('Failed to save sort order');
                                  }
                                } catch (error) {
                                  console.error('Error reordering milestones:', error);
                                  toast.error('Failed to save sort order');
                                }
                              }
                            }}
                            onDelete={(id: number) => {
                              toast.info('No available API yet');
                            }}
                            onUpdate={(id: number, field: string, value: any) => {
                              setMilestones(milestones.map(m =>
                                m.id === id ? { ...m, [field]: value } : m
                              ));
                              toast.success('Milestone updated');
                            }}
                            onEdit={(milestone: Milestone) => {
                              setEditingMilestone(milestone);
                              setIsAddMode(false); // Editing existing milestone
                              setIsEditPanelOpen(true);

                              // Parse existing delayCategory to extract team and reason
                              if (milestone.delayCategory && milestone.delayCategory !== '-') {
                                const match = milestone.delayCategory.match(/^\((.+?)\)(.+)$/);
                                if (match) {
                                  setDelayTeam(match[1]);
                                  setDelayReason(match[2]);
                                } else {
                                  setDelayTeam('');
                                  setDelayReason('');
                                }
                              } else {
                                setDelayTeam('');
                                setDelayReason('');
                              }
                            }}
                          />
                        ))}
                      </DndProvider>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Updates Section */}
            <div className={cn(glassSectionClass, "rounded-2xl border border-white/60 bg-white/62 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50")}>
              {isLoadingTimeline ? (
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-500 py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading timeline...
                </div>
              ) : (
                <Timeline
                  title="Timeline"
                  cacheKey={`P${project.id}`}
                items={progressUpdates}
                emptyMessage="暂NoneTimeline，发布第一条Timeline吧"
                addPlaceholder="Share project progress, ideas, or updates..."
                showAddInput={true}
                onEdit={async (itemId: number | string, newContent: string) => {
                  const response = await fetch(`/api/projects/${project.id}/comment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'edit',
                      transactionId: String(itemId),
                      content: newContent,
                      scheduleMonogram: scheduleMonogram || undefined,
                    }),
                  });
                  const result = await response.json();

                  if (result.success) {
                    setProgressUpdates(progressUpdates.map(u =>
                      u.id === itemId ? { ...u, content: newContent } : u
                    ));
                  } else {
                    throw new Error(result.error || 'Update failed');
                  }
                }}
                onDelete={async (itemId: number | string) => {
                  const response = await fetch(`/api/projects/${project.id}/comment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'delete',
                      transactionId: String(itemId),
                      scheduleMonogram: scheduleMonogram || undefined,
                    }),
                  });
                  const result = await response.json();

                  if (result.success) {
                    setProgressUpdates(progressUpdates.filter(u => u.id !== itemId));
                  } else {
                    throw new Error(result.error || 'Delete failed');
                  }
                }}
                onAdd={async (content: string) => {
                  const response = await fetch(`/api/projects/${project.id}/comment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      content: content,
                      scheduleMonogram: scheduleMonogram || undefined,
                    }),
                  });
                  const result = await response.json();

                  if (result.success) {
                    const newUpdate: ProgressUpdate = {
                      id: Math.max(0, ...progressUpdates.map(u => u.id)) + 1,
                      author: 'Current user',
                      content: content,
                      timestamp: new Date().toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).replace(/\//g, '-'),
                    };
                    setProgressUpdates([newUpdate, ...progressUpdates]);
                  } else {
                    throw new Error(result.error || 'Send failed');
                  }
                }}
                />
              )}
            </div>
          </div>
        )}

        {/* Kanban Tab */}
        {activeTab?.id === 'kanban' && (
          <div className="space-y-4">
            {/* Task Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-2xl border border-white/60 bg-white/66 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52">
                <p className="text-xs text-neutral-500">Total Tasks</p>
                <p className="text-2xl font-semibold text-neutral-900 mt-1">{kanbanTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/66 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52">
                <p className="text-xs text-neutral-500">Not Started</p>
                <p className="text-2xl font-semibold text-amber-600 mt-1">
                  {kanbanTasks.filter(t => t.status === 'Waiting').length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/66 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52">
                <p className="text-xs text-neutral-500">In Progress</p>
                <p className="text-2xl font-semibold text-blue-600 mt-1">
                  {kanbanTasks.filter(t => t.status === 'In Progress').length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/66 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52">
                <p className="text-xs text-neutral-500">Completed</p>
                <p className="text-2xl font-semibold text-green-600 mt-1">
                  {kanbanTasks.filter(t => t.status === 'Completed').length}
                </p>
              </div>
            </div>

            {/* Filters and Search */}
            <div className={cn(glassSectionClass, "space-y-3 rounded-2xl border border-white/60 bg-white/62 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50")}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">Task Board</h3>
                <div className="flex items-center gap-2">
                  <Select
                    value={kanbanMemberFilter.length === 0 ? 'All' : kanbanMemberFilter[0]}
                    onValueChange={(value) => {
                      if (value === 'All') {
                        setKanbanMemberFilter([]);
                      } else {
                        setKanbanMemberFilter([value]);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-[140px] rounded-xl border border-white/55 bg-white/72 text-xs shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg transition-all hover:border-sky-200/80 hover:bg-white/90">
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 opacity-50" />
                        <SelectValue placeholder="所有Members" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs">所有Members</SelectItem>
                      {Array.from(new Set(kanbanTasks.map(t => t.assignee))).map(assignee => (
                        <SelectItem key={assignee} value={assignee} className="text-xs">
                          {assignee}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={kanbanStatusFilter}
                    onValueChange={(value) => setKanbanStatusFilter(value)}
                  >
                    <SelectTrigger className="h-8 w-[120px] rounded-xl border border-white/55 bg-white/72 text-xs shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg transition-all hover:border-sky-200/80 hover:bg-white/90">
                      <div className="flex items-center gap-2">
                        <Filter className="h-3 w-3 opacity-50" />
                        <SelectValue placeholder="All Statuses" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs">All Statuses</SelectItem>
                      <SelectItem value="Waiting" className="text-xs">Waiting</SelectItem>
                      <SelectItem value="In Progress" className="text-xs">In Progress</SelectItem>
                      <SelectItem value="Completed" className="text-xs">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Search */}
              <GlassSearchInput
                value={kanbanSearchQuery}
                onChange={(e) => setKanbanSearchQuery(e.target.value)}
                placeholder="Search task title or ID..."
                containerClassName="w-full"
                inputClassName="h-9 text-sm"
              />
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-3 gap-4">
              {/* Waiting Column */}
              <div className="flex flex-col rounded-2xl border border-white/60 bg-white/62 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCollapsedColumns({ ...collapsedColumns, waiting: !collapsedColumns.waiting })}
                      className="rounded-md p-0.5 transition-colors hover:bg-white/80"
                    >
                      <ChevronRight className={`h-3.5 w-3.5 text-neutral-600 transition-transform ${collapsedColumns.waiting ? '' : 'rotate-90'}`} />
                    </button>
                    <h4 className="text-xs font-semibold text-neutral-700">
                      Waiting ({kanbanTasks.filter(t => t.status === 'Waiting' &&
                        (kanbanMemberFilter.length === 0 || kanbanMemberFilter.includes(t.assignee)) &&
                        (!kanbanSearchQuery || t.title.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(kanbanSearchQuery.toLowerCase()))
                      ).length})
                    </h4>
                  </div>
                  <button
                    onClick={() => setIsAddingKanbanTask(true)}
                    className="rounded-md p-1 transition-colors hover:bg-white/80"
                  >
                    <Plus className="h-3 w-3 text-neutral-600" />
                  </button>
                </div>

                {!collapsedColumns.waiting && (
                  <div className="space-y-2 overflow-y-auto max-h-96">
                    {isAddingKanbanTask && (
                      <div className="mb-2 rounded-xl border border-white/60 bg-white/72 p-2 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg supports-[backdrop-filter]:bg-white/58">
                        <input
                          type="text"
                          value={newKanbanTaskTitle}
                          onChange={(e) => setNewKanbanTaskTitle(e.target.value)}
                          placeholder="Enter task title..."
                          className={cn(glassInputClass, "h-8 w-full rounded-lg border-white/55 bg-white/72 px-2 text-xs shadow-none")}
                          autoFocus
                        />
                        <div className="flex gap-1 mt-2">
                          <button
                            onClick={() => {
                              if (newKanbanTaskTitle.trim()) {
                                toast.success('Task added');
                                setNewKanbanTaskTitle('');
                                setIsAddingKanbanTask(false);
                              }
                            }}
                            className="flex-1 rounded-lg border border-sky-300/75 bg-sky-500 px-2 py-1 text-xs text-white transition-colors hover:bg-sky-600"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingKanbanTask(false);
                              setNewKanbanTaskTitle('');
                            }}
                            className="rounded-lg px-2 py-1 text-xs text-neutral-600 transition-colors hover:bg-white/90"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {kanbanTasks
                      .filter(t => t.status === 'Waiting' &&
                        (kanbanMemberFilter.length === 0 || kanbanMemberFilter.includes(t.assignee)) &&
                        (!kanbanSearchQuery || t.title.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(kanbanSearchQuery.toLowerCase()))
                      )
                      .map(task => (
                        <div
                          key={task.id}
                          className="cursor-pointer rounded-xl border border-white/60 bg-white/74 p-2 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-sky-200/80"
                          onClick={() => {
                            setSelectedTaskForDialog({ id: task.taskId, fields: { name: task.title } });
                          }}
                        >
                          <p className="text-xs text-neutral-900 font-medium">{task.title}</p>
                          <p className="text-[10px] text-neutral-500 mt-1">@{task.assignee}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* In Progress Column */}
              <div className="flex flex-col rounded-2xl border border-white/60 bg-white/62 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCollapsedColumns({ ...collapsedColumns, inProgress: !collapsedColumns.inProgress })}
                      className="rounded-md p-0.5 transition-colors hover:bg-white/80"
                    >
                      <ChevronRight className={`h-3.5 w-3.5 text-neutral-600 transition-transform ${collapsedColumns.inProgress ? '' : 'rotate-90'}`} />
                    </button>
                    <h4 className="text-xs font-semibold text-neutral-700">
                      In Progress ({kanbanTasks.filter(t => t.status === 'In Progress' &&
                        (kanbanMemberFilter.length === 0 || kanbanMemberFilter.includes(t.assignee)) &&
                        (!kanbanSearchQuery || t.title.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(kanbanSearchQuery.toLowerCase()))
                      ).length})
                    </h4>
                  </div>
                </div>

                {!collapsedColumns.inProgress && (
                  <div className="space-y-2 overflow-y-auto max-h-96">
                    {kanbanTasks
                      .filter(t => t.status === 'In Progress' &&
                        (kanbanMemberFilter.length === 0 || kanbanMemberFilter.includes(t.assignee)) &&
                        (!kanbanSearchQuery || t.title.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(kanbanSearchQuery.toLowerCase()))
                      )
                      .map(task => (
                        <div
                          key={task.id}
                          className="cursor-pointer rounded-xl border border-sky-200/80 bg-sky-50/58 p-2 shadow-[0_8px_18px_rgba(14,116,144,0.08)] transition-all hover:-translate-y-0.5 hover:border-sky-300/80"
                          onClick={() => setSelectedTaskForDialog({ id: task.taskId, fields: { name: task.title } })}
                        >
                          <p className="text-xs text-neutral-900 font-medium">{task.title}</p>
                          <p className="text-[10px] text-neutral-500 mt-1">@{task.assignee}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Completed Column */}
              <div className="flex flex-col rounded-2xl border border-white/60 bg-white/62 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCollapsedColumns({ ...collapsedColumns, completed: !collapsedColumns.completed })}
                      className="rounded-md p-0.5 transition-colors hover:bg-white/80"
                    >
                      <ChevronRight className={`h-3.5 w-3.5 text-neutral-600 transition-transform ${collapsedColumns.completed ? '' : 'rotate-90'}`} />
                    </button>
                    <h4 className="text-xs font-semibold text-neutral-700">
                      Completed ({kanbanTasks.filter(t => t.status === 'Completed' &&
                        (kanbanMemberFilter.length === 0 || kanbanMemberFilter.includes(t.assignee)) &&
                        (!kanbanSearchQuery || t.title.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(kanbanSearchQuery.toLowerCase()))
                      ).length})
                    </h4>
                  </div>
                </div>

                {!collapsedColumns.completed && (
                  <div className="space-y-2 overflow-y-auto max-h-96">
                    {kanbanTasks
                      .filter(t => t.status === 'Completed' &&
                        (kanbanMemberFilter.length === 0 || kanbanMemberFilter.includes(t.assignee)) &&
                        (!kanbanSearchQuery || t.title.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(kanbanSearchQuery.toLowerCase()))
                      )
                      .map(task => (
                        <div
                          key={task.id}
                          className="cursor-pointer rounded-xl border border-white/60 bg-white/72 p-2 opacity-70 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-slate-200/80"
                          onClick={() => setSelectedTaskForDialog({ id: task.taskId, fields: { name: task.title } })}
                        >
                          <p className="text-xs text-neutral-900 font-medium line-through">{task.title}</p>
                          <p className="text-[10px] text-neutral-500 mt-1">@{task.assignee}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Docs Tab */}
        {activeTab?.id === 'docs' && (
          <div className="flex gap-4 h-[calc(100vh-300px)]">
            {/* Left: Document List */}
            <div className="min-h-0 w-80 flex flex-col rounded-2xl border border-white/60 bg-white/62 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
                <button
                  onClick={() => setIsAddingDoc(true)}
                  className="flex items-center gap-1 rounded-xl border border-sky-300/75 bg-sky-500 px-2.5 py-1.5 text-xs text-white shadow-[0_8px_18px_rgba(14,116,144,0.2)] transition-all hover:-translate-y-0.5 hover:bg-sky-600"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>

              {/* Add Document Form */}
              {isAddingDoc && (
                <div className="mb-4 flex-shrink-0 rounded-2xl border border-white/60 bg-white/74 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-lg supports-[backdrop-filter]:bg-white/60">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">New Document</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-neutral-600 mb-1 block">Document Title</label>
                      <input
                        type="text"
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        placeholder="输入Document Title..."
                        className={cn(glassInputClass, "h-9 w-full rounded-xl border-white/55 bg-white/72 px-3 text-sm shadow-none")}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-600 mb-1 block">Document URL</label>
                      <input
                        type="url"
                        value={newDocLink}
                        onChange={(e) => setNewDocLink(e.target.value)}
                        placeholder="https://..."
                        className={cn(glassInputClass, "h-9 w-full rounded-xl border-white/55 bg-white/72 px-3 text-sm shadow-none")}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-600 mb-1 block">Or upload local file</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const localURL = URL.createObjectURL(file);
                              setNewDocLink(localURL);
                              if (!newDocTitle) {
                                setNewDocTitle(file.name);
                              }
                              toast.success(`文件 "${file.name}" 已选择`);
                            }
                          }}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className={`flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-2 transition-all ${
                            isDraggingFile
                              ? 'border-sky-400 bg-sky-50/75'
                              : 'border-white/70 bg-white/68 hover:border-sky-300/80 hover:bg-white/84'
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingFile(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingFile(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingFile(false);

                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              const localURL = URL.createObjectURL(file);
                              setNewDocLink(localURL);
                              if (!newDocTitle) {
                                setNewDocTitle(file.name);
                              }
                              toast.success(`文件 "${file.name}" 已选择`);
                            }
                          }}
                        >
                          <Upload className="h-4 w-4 text-neutral-600" />
                          <span className="text-sm text-neutral-600">
                            {isDraggingFile ? 'Drop to upload' : 'Click or drag file to upload'}
                          </span>
                        </label>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">Supports common document formats</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (newDocTitle.trim() && newDocLink.trim()) {
                            const newDoc = {
                              id: projectDocs.length + 1,
                              title: newDocTitle,
                              link: newDocLink,
                              content: '',
                            };
                            setProjectDocs([...projectDocs, newDoc]);
                            setNewDocTitle('');
                            setNewDocLink('');
                            setIsAddingDoc(false);
                            toast.success('Document added');
                          } else {
                            toast.error('Please complete all required fields');
                          }
                        }}
                        className="flex-1 rounded-xl border border-sky-300/75 bg-sky-500 px-4 py-2 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-sky-600"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingDoc(false);
                          setNewDocTitle('');
                          setNewDocLink('');
                        }}
                        className="rounded-xl border border-white/55 bg-white/70 px-4 py-2 text-sm text-neutral-600 transition-all hover:border-sky-200/70 hover:bg-white/90"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Document List */}
              <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
                {projectDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-xl border p-2 transition-all ${
                      selectedDoc?.id === doc.id
                        ? 'border-sky-200/90 bg-sky-50/78 text-sky-700 shadow-[0_8px_18px_rgba(14,116,144,0.1)]'
                        : 'border-white/60 bg-white/68 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/84'
                    }`}
                    onClick={() => {
                      setSelectedDoc(doc);
                      setIsEditingDoc(false);
                    }}
                  >
                    <FileText className={`h-4 w-4 flex-shrink-0 ${selectedDoc?.id === doc.id ? 'text-blue-600' : 'text-neutral-500'}`} />
                    <span className={`flex-1 text-sm truncate ${selectedDoc?.id === doc.id ? 'text-blue-600 font-medium' : 'text-neutral-900'}`}>
                      {doc.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Confirm要删除这个文档吗？')) {
                          setProjectDocs(projectDocs.filter(d => d.id !== doc.id));
                          if (selectedDoc?.id === doc.id) {
                            setSelectedDoc(null);
                          }
                          toast.success('Document deleted');
                        }
                      }}
                      className="rounded-md p-1 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-100"
                      title="删除文档"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>

              {projectDocs.length === 0 && !isAddingDoc && (
                <p className="text-sm text-neutral-500 text-center py-8">暂None文档，点击"Add"按钮Add</p>
              )}
            </div>

            {/* Right: Document Preview/Edit */}
            <div className="min-h-0 flex-1 rounded-2xl border border-white/60 bg-white/62 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
              {selectedDoc ? (
                <>
                  {/* Document Header */}
                  <div className="mb-4 flex flex-shrink-0 items-center justify-between border-b border-white/60 pb-3">
                    <div className="flex-1">
                      {isEditingDoc ? (
                        <input
                          type="text"
                          value={editingDocContent}
                          onChange={(e) => setEditingDocContent(e.target.value)}
                          className={cn(glassInputClass, "h-10 w-full rounded-xl border-white/55 bg-white/72 px-3 text-lg font-semibold shadow-none")}
                          placeholder="Document Title"
                        />
                      ) : (
                        <h2 className="text-lg font-semibold text-neutral-900">{selectedDoc.title}</h2>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {isEditingDoc ? (
                        <>
                          <button
                            onClick={() => {
                              if (editingDocContent.trim()) {
                                setProjectDocs(projectDocs.map(doc =>
                                  doc.id === selectedDoc.id
                                    ? { ...doc, title: editingDocContent }
                                    : doc
                                ));
                                setSelectedDoc({ ...selectedDoc, title: editingDocContent });
                                setIsEditingDoc(false);
                                toast.success('Document updated');
                              } else {
                                toast.error('Document Title不能为空');
                              }
                            }}
                            className="flex items-center gap-1 rounded-xl border border-sky-300/75 bg-sky-500 px-3 py-1.5 text-xs text-white transition-all hover:-translate-y-0.5 hover:bg-sky-600"
                          >
                            <Check className="h-3 w-3" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingDoc(false);
                              setEditingDocContent(selectedDoc.title);
                            }}
                            className="rounded-xl border border-white/55 bg-white/72 px-3 py-1.5 text-xs text-neutral-600 transition-all hover:border-sky-200/70 hover:bg-white/90"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setIsEditingDoc(true);
                              setEditingDocContent(selectedDoc.title);
                            }}
                            className="flex items-center gap-1 rounded-xl border border-white/55 bg-white/72 px-3 py-1.5 text-xs text-neutral-700 transition-all hover:border-sky-200/70 hover:bg-white/90"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </button>
                          <a
                            href={selectedDoc.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-xl border border-sky-200/70 bg-sky-50/75 px-3 py-1.5 text-xs text-sky-700 transition-all hover:border-sky-300/80 hover:bg-sky-100/75"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Document Content/Preview */}
                  <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/60 bg-white/74 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                    {selectedDoc.content ? (
                      <div className="p-6 overflow-y-auto h-full">
                        <RemarkupRenderer content={selectedDoc.content} />
                      </div>
                    ) : selectedDoc.link.startsWith('blob:') || selectedDoc.link.startsWith('http') ? (
                      <div className="relative w-full h-full">
                        <iframe
                          src={selectedDoc.link}
                          className="w-full h-full border-0"
                          title={selectedDoc.title}
                          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        />
                        <div className="absolute right-4 top-4 rounded-xl border border-white/70 bg-white/88 px-3 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.1)] backdrop-blur-lg">
                          <a
                            href={selectedDoc.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            在新窗口Open
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <FileText className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                          <p className="text-sm text-neutral-600 mb-2">None法预览此文档</p>
                          <a
                            href={selectedDoc.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-sky-300/75 bg-sky-500 px-4 py-2 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-sky-600"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open链接
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                    <p className="text-sm text-neutral-500">Select a document from the left to preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task Detail Dialog */}
      {selectedTaskForDialog && (
        <>
          <TaskDetailDialog
            task={selectedTaskForDialog}
            open={!!selectedTaskForDialog}
            onOpenChange={(open: boolean) => {
              if (!open) setSelectedTaskForDialog(null);
            }}
          />
        </>
      )}

      {/* Milestone Edit Panel */}
      {isEditPanelOpen && editingMilestone && (
        <Dialog open={isEditPanelOpen} onOpenChange={setIsEditPanelOpen}>
          <DialogContent showCloseButton={false} className="z-[10100] flex max-h-[90vh] max-w-[600px] flex-col gap-0 overflow-y-auto rounded-3xl border border-white/70 bg-[#f8fbff]/92 p-0 shadow-[0_28px_66px_rgba(15,23,42,0.2)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78">
            <div className="space-y-6 p-6">
              <div className="flex items-center justify-between mb-2">
                <DialogTitle className="text-lg font-semibold text-neutral-900">
                  {isAddMode ? 'Create Milestone' : 'Edit Milestone'}
                </DialogTitle>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  {/* Node Name */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Node Name</label>
                    <Input
                      type="text"
                      value={editingMilestone.node}
                      onChange={(e) => setEditingMilestone({ ...editingMilestone, node: e.target.value })}
                      className={cn(glassInputClass, "h-9 w-full rounded-xl border-white/55 bg-white/72 text-sm shadow-none")}
                    />
                  </div>

                  {/* Bind Node Pool Node - Bind Node Pool Item */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Bind Node Pool Item</label>
                    <NodePoolPicker
                      value={editingMilestone.bindItem || ''}
                      onChange={(phid) => setEditingMilestone({ ...editingMilestone, bindItem: phid })}
                      items={nodePoolItems.map(i => ({
                        id: i.id,
                        phid: i.phid,
                        name: i.fields.itemName,
                      }))}
                      isLoading={isLoadingNodePoolItems}
                      placeholder="Select a node pool item..."
                    />
                  </div>

                  {/* Pre Node */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Predecessor</label>
                    <Select
                      value={editingMilestone.preNode}
                      onValueChange={(value) => setEditingMilestone({ ...editingMilestone, preNode: value })}
                    >
                      <SelectTrigger className={cn(glassInputClass, "h-9 w-full rounded-xl border-white/55 bg-white/72 text-sm shadow-none")}>
                        <SelectValue placeholder="选择Predecessor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-">None</SelectItem>
                        {milestones.filter(m => m.id !== editingMilestone.id).map(m => (
                          <SelectItem key={m.node} value={m.node}>
                            {m.node}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Original Plan */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Original Plan</label>
                    <DatePicker
                      value={editingMilestone.originalPlan}
                      onChange={(date) => setEditingMilestone({ ...editingMilestone, originalPlan: date })}
                      placeholder="Select date"
                      className="w-full"
                    />
                  </div>

                  {/* Updated Plan - Only show in edit mode */}
                  {!isAddMode && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Updated Plan</label>
                      <DatePicker
                        value={editingMilestone.updatedPlan}
                        onChange={(date) => setEditingMilestone({ ...editingMilestone, updatedPlan: date })}
                        placeholder="Select date"
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Actual Complete - Only show in edit mode */}
                  {!isAddMode && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Actual Completion</label>
                      <DatePicker
                        value={editingMilestone.actualComplete}
                        onChange={(date) => setEditingMilestone({ ...editingMilestone, actualComplete: date })}
                        placeholder="Select date"
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Process Node and Task ID fields are hidden - functionality not implemented yet
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Process Node</label>
                  {/* Delay-related fields - Only show in edit mode */}
                  {!isAddMode && (
                    <>
                      {/* Node Delay */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Node Delay</label>
                        <Input
                          type="text"
                          value={editingMilestone.nodeDelay}
                          onChange={(e) => setEditingMilestone({ ...editingMilestone, nodeDelay: e.target.value })}
                          className={cn(glassInputClass, "h-9 w-full rounded-xl border-white/55 bg-white/72 text-sm shadow-none")}
                          placeholder="3d"
                        />
                      </div>

                      {/* Total Delay */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Total Delay</label>
                        <Input
                          type="text"
                          value={editingMilestone.totalDelay}
                          onChange={(e) => setEditingMilestone({ ...editingMilestone, totalDelay: e.target.value })}
                          className={cn(glassInputClass, "h-9 w-full rounded-xl border-white/55 bg-white/72 text-sm shadow-none")}
                          placeholder="5d"
                        />
                      </div>

                      {/* Delay Count */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Delay Count</label>
                        <Input
                          type="text"
                          value={editingMilestone.delayCount}
                          onChange={(e) => setEditingMilestone({ ...editingMilestone, delayCount: e.target.value })}
                          className={cn(glassInputClass, "h-9 w-full rounded-xl border-white/55 bg-white/72 text-sm shadow-none")}
                          placeholder="2"
                        />
                      </div>

                      {/* Delay Team */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Delay Team</label>
                        <Select
                          value={delayTeam}
                          onValueChange={(value) => {
                            setDelayTeam(value);
                            setDelayReason('');
                          }}
                        >
                          <SelectTrigger className={cn(glassInputClass, "h-9 w-full rounded-xl border-white/55 bg-white/72 text-sm shadow-none")}>
                            <SelectValue placeholder="选择Delay Team" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null_option">Please select</SelectItem>
                            {['产品', '软件', '硬件', '测试', '结构', 'ISP', '算法', '采购', '生产', 'CAD', '其它', '历史存档'].map(team => (
                              <SelectItem key={team} value={team}>{team}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Delay Reason - Conditional based on team */}
                      {delayTeam && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Delay Reason</label>
                          <Select
                            value={delayReason}
                            onValueChange={(value) => {
                              setDelayReason(value);
                              setEditingMilestone({ ...editingMilestone, delayCategory: `(${delayTeam})${value}` });
                            }}
                          >
                            <SelectTrigger className={cn(glassInputClass, "h-9 w-full rounded-xl border-white/55 bg-white/72 text-sm shadow-none")}>
                              <SelectValue placeholder="选择Delay Reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {getDelayReasonOptions(delayTeam).map(option => (
                                <SelectItem key={option.value || 'empty'} value={option.value || 'empty_val'}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Delay Description - Conditional based on team selection */}
                      {delayTeam && (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Delay Reason描述</label>
                          <textarea
                            value={delayDesc}
                            onChange={(e) => setDelayDesc(e.target.value)}
                            className={cn(glassInputClass, "w-full resize-none rounded-xl border-white/55 bg-white/72 px-3 py-2 text-sm shadow-none focus-visible:ring-0")}
                            placeholder="请输入详细的Delay Reason描述..."
                            rows={3}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 border-t border-white/60 pt-4">
                  <button
                    onClick={async () => {
                      // Handle Add Mode
                      if (isAddMode) {
                        if (!editingMilestone.node.trim()) {
                          toast.error('Please enter a node name');
                          return;
                        }

                        if (!editingMilestone.bindItem) {
                          toast.error('Please select a node pool item');
                          return;
                        }

                        if (!scheduleId) {
                          toast.error('Cannot get schedule ID. Please refresh and retry');
                          return;
                        }

                        // Call API to create milestone
                        try {
                          // Resolve bindItem to PHID if it's a name
                          let bindItemPHID = editingMilestone.bindItem || '';
                          if (bindItemPHID && !bindItemPHID.startsWith('PHID-IALL-')) {
                            const match = nodePoolItems.find(i => i.fields?.itemName === bindItemPHID);
                            bindItemPHID = match?.phid || '';
                          }

                          // Resolve preMilestone name to PHID
                          let preMilestonePHID: string | undefined = undefined;
                          if (editingMilestone.preNode && editingMilestone.preNode !== '-') {
                            const preMilestone = milestones.find(m => m.node === editingMilestone.preNode);
                            if (preMilestone?.milePHID) {
                              preMilestonePHID = preMilestone.milePHID;
                            }
                          }

                          const response = await fetch(`/api/projects/${project.id}/milestones/create`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              scheduleId,
                              milestoneName: editingMilestone.node,
                              bindItem: bindItemPHID,
                              preMilestone: preMilestonePHID,
                              estimateFinishDate: editingMilestone.originalPlan ? Math.floor(new Date(editingMilestone.originalPlan).getTime() / 1000) : undefined,
                            }),
                          });

                          const result = await response.json();

                          if (!result.success) {
                            toast.error(result.error || 'Failed to create milestone');
                            return;
                          }

                          // Add new milestone to the TOP of the list with returned PHID
                          const newMilestoneWithPHID = {
                            ...editingMilestone,
                            milePHID: result.milestone.phid,
                          };
                          const newMilestones = [newMilestoneWithPHID, ...milestones];
                          setMilestones(calculateMilestoneStatus(newMilestones));
                          setIsEditPanelOpen(false);
                          setIsAddMode(false);
                          toast.success('Milestone created');
                        } catch (error: any) {
                          console.error('Error creating milestone:', error);
                          toast.error('Failed to create milestone: ' + (error.message || '未知错误'));
                        }
                        return;
                      }

                      // Handle Edit Mode
                      const originalMilestone = milestones.find(m => m.id === editingMilestone.id);
                      if (!originalMilestone) return;

                      // Capture current values before closing panel (closure issue fix)
                      const capturedMilestone = { ...editingMilestone };
                      const capturedOriginal = { ...originalMilestone };
                      const capturedDelayTeam = delayTeam;
                      const capturedDelayReason = delayReason;
                      const capturedDelayDesc = delayDesc;
                      const capturedNodePoolItems = nodePoolItems;

                      // Parse original delay category to get original team/reason
                      let originalDelayTeam = '';
                      let originalDelayReason = '';
                      if (capturedOriginal.delayCategory && capturedOriginal.delayCategory !== '-') {
                        const match = capturedOriginal.delayCategory.match(/^\((.+?)\)(.+)$/);
                        if (match) {
                          originalDelayTeam = match[1];
                          originalDelayReason = match[2];
                        }
                      }

                      // Optimistic update with status recalculation
                      const updatedMilestones = milestones.map(m =>
                        m.id === editingMilestone.id ? editingMilestone : m
                      );
                      // Recalculate status based on actualComplete field
                      setMilestones(calculateMilestoneStatus(updatedMilestones));
                      setIsEditPanelOpen(false);

                      // Show toast with undo
                      toastWithUndo({
                        message: 'Milestone updated',
                        duration: 5000,
                        onConfirm: async () => {
                          try {
                            if (!capturedMilestone.milePHID) {
                              console.error('Missing milePHID for milestone:', capturedMilestone);
                              toast.error('Missing milestone PHID, cannot save');
                              return;
                            }

                            // Build request body with ONLY CHANGED fields
                            const requestBody: any = {
                              milePHID: capturedMilestone.milePHID,
                            };

                            // Only include fields that have actually changed
                            if (capturedMilestone.node !== capturedOriginal.node) {
                              requestBody.milestoneName = capturedMilestone.node;
                            }

                            if (capturedMilestone.preNode !== capturedOriginal.preNode) {
                              requestBody.preMilestone = capturedMilestone.preNode !== '-' ? capturedMilestone.preNode : '';
                            }

                            const resolveBindItemPhid = (value: string | undefined) => {
                              if (!value) return '';
                              if (value.startsWith('PHID-IALL-')) return value;
                              const match = capturedNodePoolItems.find(i => i.fields?.itemName === value);
                              return match?.phid || '';
                            };

                            const newBindItem = resolveBindItemPhid(capturedMilestone.bindItem);
                            const origBindItem = resolveBindItemPhid(capturedOriginal.bindItem);
                            if (newBindItem !== origBindItem) {
                              requestBody.bindItem = newBindItem;
                            }

                            // Compare dates (convert to timestamp for comparison)
                            const newUpdatedPlan = capturedMilestone.updatedPlan?.getTime();
                            const origUpdatedPlan = capturedOriginal.updatedPlan?.getTime();
                            if (newUpdatedPlan !== origUpdatedPlan) {
                              // Include the date if changed, or empty string to clear it
                              requestBody.updateFinishDate = capturedMilestone.updatedPlan
                                ? capturedMilestone.updatedPlan.toISOString()
                                : null; // null to clear the date
                            }

                            const newActualComplete = capturedMilestone.actualComplete?.getTime();
                            const origActualComplete = capturedOriginal.actualComplete?.getTime();
                            if (newActualComplete !== origActualComplete) {
                              // Include the date if changed, or null to clear it
                              requestBody.actualFinishDate = capturedMilestone.actualComplete
                                ? capturedMilestone.actualComplete.toISOString()
                                : null; // null to clear the date
                            }

                            // Compare delay info
                            if (capturedDelayTeam !== originalDelayTeam) {
                              requestBody.delayGroup = capturedDelayTeam || '';
                            }

                            if (capturedDelayReason !== originalDelayReason && capturedDelayTeam) {
                              requestBody.delayReason = capturedDelayReason || '';
                            }

                            // Include delay description if team is selected and description is provided
                            if (capturedDelayTeam && capturedDelayDesc) {
                              requestBody.delayDesc = capturedDelayDesc;
                            }

                            // Check if there are any changes to save
                            const hasChanges = Object.keys(requestBody).length > 1; // More than just milePHID
                            if (!hasChanges) {
                              toast.info('No changes detected');
                              return;
                            }

                            // Call schedule.milestone.edit API to update milestone
                            await httpClient('/api/projects/edit-milestone', {
                              method: 'POST',
                              body: requestBody
                            });
                            toast.success('Milestone saved to server');
                          } catch (error: any) {
                            console.error('Failed to save milestone:', error);
                            toast.error('Save failed: ' + (error.message || '未知错误'));
                            // Revert on error
                            setMilestones(milestones.map(m =>
                              m.id === capturedOriginal.id ? capturedOriginal : m
                            ));
                          }
                        },
                        onUndo: () => {
                          // Revert changes
                          setMilestones(milestones.map(m =>
                            m.id === originalMilestone.id ? originalMilestone : m
                          ));
                        }
                      });
                    }}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setIsEditPanelOpen(false)}
                    className="px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
