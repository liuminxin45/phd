import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronsDownUp,
  ChevronsUpDown,
  Flag,
  ListTodo,
  RefreshCw,
} from 'lucide-react';
import { httpClient } from '@/lib/httpClient';
import { useUser } from '@/contexts/UserContext';
import type { UnstandardItem, UnstandardResponse } from '@/pages/api/unstandard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { glassPanelStrongClass, glassSectionClass } from '@/components/ui/glass';

interface UnstandardWidgetProps {
  teamId?: string;
  onTaskClick?: (taskId: number) => void;
  onProjectClick?: (projectId: number) => void;
}

type UnstandardTab = 'project' | 'milestone' | 'task';

function getItemMeta(type: UnstandardItem['type']) {
  switch (type) {
    case 'project':
      return {
        label: 'Project',
        shortLabel: 'Projects',
        icon: BriefcaseBusiness,
        badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700',
        iconClassName: 'text-sky-600',
      };
    case 'milestone':
      return {
        label: 'Milestone',
        shortLabel: 'Milestones',
        icon: Flag,
        badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
        iconClassName: 'text-amber-600',
      };
    case 'task':
    default:
      return {
        label: 'Task',
        shortLabel: 'Tasks',
        icon: ListTodo,
        badgeClassName: 'border-violet-200 bg-violet-50 text-violet-700',
        iconClassName: 'text-violet-600',
      };
  }
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  accentClassName,
  caption,
}: {
  icon: typeof AlertCircle;
  title: string;
  value: number;
  accentClassName: string;
  caption: string;
}) {
  return (
    <div className="glass-interactive rounded-xl border border-white/58 bg-white/62 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 transition-all duration-200 hover:border-sky-200/80 hover:bg-white/74">
      <div className="mb-1 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', accentClassName)} />
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground">{caption}</p>
    </div>
  );
}

function UnstandardListItem({
  item,
  onTaskClick,
  onProjectClick,
}: {
  item: UnstandardItem;
  onTaskClick?: (taskId: number) => void;
  onProjectClick?: (projectId: number) => void;
}) {
  const meta = getItemMeta(item.type);
  const Icon = meta.icon;

  const handleOpen = () => {
    if (item.type === 'project' && onProjectClick) {
      onProjectClick(parseInt(item.id, 10));
      return;
    }

    if (item.type === 'task' && onTaskClick) {
      onTaskClick(parseInt(item.id, 10));
      return;
    }

    window.open(item.url, '_blank');
  };

  const opensInline = (item.type === 'project' && !!onProjectClick) || (item.type === 'task' && !!onTaskClick);

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="glass-interactive group flex w-full items-start justify-between gap-3 rounded-xl border border-white/58 bg-white/62 p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 transition-all duration-200 hover:border-sky-200/80 hover:bg-white/74 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn('text-[11px]', meta.badgeClassName)}>
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground truncate">Owner: {item.owner || '--'}</span>
        </div>

        <div className="mt-2 flex items-start gap-2">
          <div className={cn('mt-0.5 rounded-md bg-muted/60 p-1.5', meta.iconClassName)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
              {item.name}
            </p>
            {item.reason && (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {item.reason}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">{opensInline ? 'Open Details' : 'Handle Now'}</span>
        <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

export function UnstandardWidget({ teamId = '16', onTaskClick, onProjectClick }: UnstandardWidgetProps) {
  const { user } = useUser();
  const [myProjects, setMyProjects] = useState<UnstandardItem[]>([]);
  const [myMilestones, setMyMilestones] = useState<UnstandardItem[]>([]);
  const [myTasks, setMyTasks] = useState<UnstandardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<UnstandardTab>('project');
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await httpClient<UnstandardResponse>('/api/unstandard', {
        params: { teamId },
      });

      if (!user?.realName) {
        setMyProjects([]);
        setMyMilestones([]);
        setMyTasks([]);
        return;
      }

      const userName = user.realName;
      setMyProjects(result.projects.filter(project => project.owner && project.owner.includes(userName)));
      setMyMilestones(result.milestones.filter(milestone => milestone.owner && milestone.owner.includes(userName)));
      setMyTasks(result.tasks.filter(task => task.owner && task.owner.includes(userName)));
    } catch (err: any) {
      setError(err.message || 'Failed to load unstandard data');
    } finally {
      setLoading(false);
    }
  }, [teamId, user?.realName]);

  useEffect(() => {
    fetchData();

    const intervalId = setInterval(() => {
      fetchData();
    }, 30 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [fetchData]);

  const itemsByTab = useMemo<Record<UnstandardTab, UnstandardItem[]>>(() => ({
    project: myProjects,
    milestone: myMilestones,
    task: myTasks,
  }), [myMilestones, myProjects, myTasks]);

  const items = itemsByTab[activeTab];
  const allAttentionItems = useMemo(
    () => [...myProjects, ...myMilestones, ...myTasks],
    [myMilestones, myProjects, myTasks],
  );

  return (
    <Card className={cn(glassPanelStrongClass, "overflow-hidden border-white/65 bg-white/62 shadow-[0_22px_52px_rgba(15,23,42,0.16)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/56")}>
      <div className="flex items-center justify-between border-b border-white/50 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-200/70 bg-amber-50/82 text-amber-600">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold leading-none">Unstandard</h3>
            {!loading && allAttentionItems.length > 0 && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                {allAttentionItems.length} pending
              </Badge>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl border border-white/45 bg-white/42 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/28 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/66"
          onClick={() => setDetailsExpanded(prev => !prev)}
          aria-expanded={detailsExpanded}
          aria-label={detailsExpanded ? 'Collapse Unstandard details' : 'Expand Unstandard details'}
        >
          {detailsExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
        </Button>
      </div>

      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <div className="rounded-xl border p-4">
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <Button variant="link" onClick={fetchData} className="mt-2 h-auto p-0 text-sky-700">
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SummaryCard
                icon={AlertCircle}
                title="Need Attention"
                value={allAttentionItems.length}
                accentClassName={allAttentionItems.length > 0 ? 'text-amber-500' : 'text-emerald-500'}
                caption={allAttentionItems.length > 0 ? 'Items currently assigned to you' : 'No abnormal items at the moment'}
              />
              <SummaryCard
                icon={BriefcaseBusiness}
                title="Projects"
                value={myProjects.length}
                accentClassName="text-sky-500"
                caption="Project standard items"
              />
              <SummaryCard
                icon={Flag}
                title="Milestones"
                value={myMilestones.length}
                accentClassName="text-amber-500"
                caption="Milestone standard items"
              />
              <SummaryCard
                icon={ListTodo}
                title="Tasks"
                value={myTasks.length}
                accentClassName="text-violet-500"
                caption="Task standard items"
              />
            </div>

            {detailsExpanded && (
              <>
                <div className={cn(glassSectionClass, "flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between")}>
                  <div>
                    <p className="text-sm font-medium text-foreground">Detail Filter</p>
                    <p className="text-xs text-muted-foreground">Filter by type and jump directly to handle each item.</p>
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl border border-white/45 bg-white/42 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/28 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/66 hover:text-slate-900"
                      onClick={fetchData}
                      aria-label="Refresh Unstandard data"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <div className="flex flex-1 gap-1 rounded-xl border border-white/45 bg-white/55 p-1 backdrop-blur-lg sm:flex-none">
                    {(['project', 'milestone', 'task'] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-none',
                          activeTab === tab
                            ? 'bg-white/90 text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-white/72 hover:text-foreground',
                        )}
                      >
                        {getItemMeta(tab).shortLabel} ({itemsByTab[tab].length})
                      </button>
                    ))}
                    </div>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/70 bg-white/35 py-12 text-muted-foreground/60">
                    <AlertCircle className="mb-2 h-10 w-10 opacity-20" />
                    <p className="text-sm">No pending items in this category</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {items.map(item => (
                      <UnstandardListItem
                        key={`${item.type}-${item.id}`}
                        item={item}
                        onTaskClick={onTaskClick}
                        onProjectClick={onProjectClick}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
