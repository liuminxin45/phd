import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassIconButton, glassSectionClass, glassToolbarClass } from '@/components/ui/glass';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const glassInputClass = 'rounded-xl border border-white/58 bg-white/72 backdrop-blur-lg supports-[backdrop-filter]:bg-white/58';
const glassSelectContentClass = 'rounded-xl border border-white/60 bg-white/88 shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/72';

type RoadmapStage = 'now' | 'next' | 'later' | 'done';
type RoadmapTag = 'Architecture' | 'Business' | 'Tooling' | 'AI';

type ViewMode = 'list' | 'timeline';

const MAX_NOW_ITEMS = 3;

interface RoadmapItem {
  id: string;
  stage: RoadmapStage;
  title: string;
  note: string;
  tag: RoadmapTag;
  cycle: string;
  why: string;
  progress: number;
}

const STORAGE_KEY = 'settings:personal-roadmap:v1';

const DEFAULT_ITEMS: RoadmapItem[] = [
  {
    id: 'now-1',
    stage: 'now',
    title: 'Utility 统一Architecture重构',
    note: '插件通信层重写 + RPC 整理',
    tag: 'Architecture',
    cycle: '4 周',
    why: '为后续插件化打基础',
    progress: 65,
  },
  {
    id: 'next-1',
    stage: 'next',
    title: 'ROI Web 化',
    note: 'Estimate: 3 月启动',
    tag: 'Business',
    cycle: '1 月',
    why: '让数据分析结果更容易被复用',
    progress: 0,
  },
  {
    id: 'later-1',
    stage: 'later',
    title: '多平台插件发布机制',
    note: '统一打包、签名与分发流程',
    tag: 'Tooling',
    cycle: '2 月',
    why: '降低后续插件迭代成本',
    progress: 0,
  },
  {
    id: 'done-1',
    stage: 'done',
    title: 'RPC 服务端改造',
    note: '',
    tag: 'Architecture',
    cycle: '3 周',
    why: '为后续服务分层铺路',
    progress: 100,
  },
];

const STAGE_LABEL: Record<RoadmapStage, string> = {
  now: 'NOW',
  next: 'NEXT',
  later: 'LATER',
  done: 'DONE',
};

function normalizeStage(stage: string): RoadmapStage {
  if (stage === 'doing') return 'now';
  if (stage === 'now' || stage === 'next' || stage === 'later' || stage === 'done') {
    return stage;
  }
  return 'next';
}

function createItem(stage: RoadmapStage): RoadmapItem {
  return {
    id: `${stage}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stage,
    title: '新的 roadmap items目',
    note: '',
    tag: 'Tooling',
    cycle: '2 周',
    why: '',
    progress: stage === 'now' ? 20 : stage === 'done' ? 100 : 0,
  };
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function formatMonthShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function cycleToDays(cycle: string): number {
  const normalized = cycle.replace(/\s+/g, '');
  const matched = normalized.match(/(\d+)(天|日|周|月)/);
  if (!matched) return 14;
  const count = Number(matched[1]) || 1;
  const unit = matched[2];
  if (unit === '天' || unit === '日') return count;
  if (unit === '周') return count * 7;
  if (unit === '月') return count * 30;
  return 14;
}

export function RoadmapTab() {
  const [items, setItems] = useState<RoadmapItem[]>(DEFAULT_ITEMS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { items?: RoadmapItem[]; lastUpdated?: string };
      if (Array.isArray(parsed.items)) {
        setItems(
          parsed.items.map((item) => ({
            ...item,
            stage: normalizeStage(item.stage),
          })),
        );
      }
      if (parsed.lastUpdated) {
        setLastUpdated(new Date(parsed.lastUpdated));
      }
    } catch {
      // ignore invalid localStorage payload
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hydrated) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items,
        lastUpdated: lastUpdated.toISOString(),
      }),
    );
  }, [items, lastUpdated, hydrated]);

  const nowCount = useMemo(() => items.filter((item) => item.stage === 'now').length, [items]);
  const doneCount = useMemo(() => items.filter((item) => item.stage === 'done').length, [items]);

  const timelineItems = useMemo(() => {
    const stageWeight: Record<RoadmapStage, number> = {
      now: 0,
      next: 1,
      later: 2,
      done: 3,
    };

    const planned = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.stage === 'now' || item.stage === 'next' || item.stage === 'later')
      .sort((a, b) => {
        const weightDiff = stageWeight[a.item.stage] - stageWeight[b.item.stage];
        if (weightDiff !== 0) return weightDiff;
        return a.index - b.index;
      })
      .map(({ item }) => item);

    const anchor = new Date();
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    let offsetDays = 0;

    return planned.map((item) => {
      const at = new Date(first);
      at.setDate(first.getDate() + offsetDays);
      offsetDays += cycleToDays(item.cycle || '2 周');

      return {
        id: item.id,
        month: formatMonthShort(at),
        title: item.title,
      };
    });
  }, [items]);

  const addItem = (stage: RoadmapStage) => {
    if (stage === 'now' && nowCount >= MAX_NOW_ITEMS) return;
    const next = createItem(stage);
    setItems((prev) => [...prev, next]);
    setEditingId(next.id);
    setLastUpdated(new Date());
  };

  const updateItem = (id: string, patch: Partial<RoadmapItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setLastUpdated(new Date());
  };

  const duplicateUnder = (id: string) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const source = prev[index];
      if (source.stage === 'now' && nowCount >= MAX_NOW_ITEMS) return prev;
      const nextItem = createItem(source.stage);
      const merged = {
        ...nextItem,
        tag: source.tag,
        cycle: source.cycle,
      };
      const next = [...prev];
      next.splice(index + 1, 0, merged);
      setEditingId(merged.id);
      return next;
    });
    setLastUpdated(new Date());
  };

  const markDone = (id: string) => {
    updateItem(id, { stage: 'done', progress: 100 });
    setEditingId(null);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setEditingId((prev) => (prev === id ? null : prev));
    setLastUpdated(new Date());
  };

  const reorderByDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;

    setItems((prev) => {
      const sourceIndex = prev.findIndex((item) => item.id === draggingId);
      const targetIndex = prev.findIndex((item) => item.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const source = prev[sourceIndex];
      const target = prev[targetIndex];
      if (source.stage !== target.stage) return prev;

      const next = [...prev];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });

    setLastUpdated(new Date());
  };

  const renderItem = (item: RoadmapItem) => {
    const isEditing = editingId === item.id;
    const isDone = item.stage === 'done';

    return (
      <div
        key={item.id}
        draggable
        onDragStart={() => setDraggingId(item.id)}
        onDragEnd={() => setDraggingId(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => reorderByDrop(item.id)}
        onDoubleClick={() => setEditingId(item.id)}
        className={cn(
          'group rounded-xl border px-3 py-2.5 transition-colors',
          isDone
            ? 'border-white/50 bg-white/34 text-slate-400 hover:bg-white/44'
            : 'border-white/58 bg-white/52 text-slate-700 hover:bg-white/62',
        )}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 mt-1 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      markDone(item.id);
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      duplicateUnder(item.id);
                    }
                    if (e.key === 'Escape') {
                      setEditingId(null);
                    }
                  }}
                  className="w-full bg-transparent border-0 border-b border-neutral-300 px-0 py-1 text-sm font-medium text-neutral-900 outline-none"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Select value={item.tag} onValueChange={(v) => updateItem(item.id, { tag: v as RoadmapTag })}>
                    <SelectTrigger className={cn('h-8 text-xs', glassInputClass)}>
                      <SelectValue placeholder="Tag" />
                    </SelectTrigger>
                    <SelectContent className={glassSelectContentClass}>
                      <SelectItem value="Architecture">Architecture</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Tooling">Tooling</SelectItem>
                      <SelectItem value="AI">AI</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={item.cycle}
                    onChange={(e) => updateItem(item.id, { cycle: e.target.value })}
                    placeholder="Cycle (e.g. 2w)"
                    className={cn('h-8 text-xs', glassInputClass)}
                  />
                  <Input
                    value={item.why}
                    onChange={(e) => updateItem(item.id, { why: e.target.value })}
                    placeholder="Goal: 为什么做"
                    className={cn('h-8 text-xs', glassInputClass)}
                  />
                </div>
                {item.stage === 'now' && (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={item.progress}
                    onChange={(e) => updateItem(item.id, { progress: Number(e.target.value) })}
                  />
                )}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm leading-6">
                    <span
                      className={cn(
                        'mr-2',
                        isDone ? 'text-neutral-400 line-through' : item.stage === 'now' ? 'text-neutral-900' : 'text-neutral-700',
                      )}
                    >
                      {isDone ? '✓' : item.stage === 'now' ? '●' : '○'} {item.title}
                    </span>
                  </div>
                  <GlassIconButton
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(item.id);
                    }}
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete item"
                    title="Delete"
                    tone="warning"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </GlassIconButton>
                </div>
                <p className={cn('text-xs mt-1.5', isDone ? 'text-neutral-400 line-through' : 'text-neutral-500')}>
                  [{item.tag}] Estimate: {item.cycle || '待定'}
                  {item.why ? ` · Goal: ${item.why}` : ''}
                </p>
                {item.note && <p className="text-xs text-neutral-500 mt-1">{item.note}</p>}
                {item.stage === 'now' && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span>{item.progress}%</span>
                      <div className="h-1.5 flex-1 rounded-full bg-neutral-200 overflow-hidden">
                        <div className="h-full bg-neutral-800" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStage = (stage: RoadmapStage) => {
    const list = items.filter((item) => item.stage === stage);

    return (
      <section key={stage} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs tracking-[0.2em] text-neutral-500 font-semibold">{STAGE_LABEL[stage]}</h3>
          {stage !== 'done' && (
            <GlassIconButton
              onClick={() => addItem(stage)}
              disabled={stage === 'now' && nowCount >= MAX_NOW_ITEMS}
              title={`添加到 ${STAGE_LABEL[stage]}`}
              aria-label={`添加到 ${STAGE_LABEL[stage]}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </GlassIconButton>
          )}
        </div>

        <div className="space-y-2">
          {list.map((item) => renderItem(item))}
          {list.length === 0 && <p className="text-xs text-neutral-400 py-2">No content yet. Double-click any item to edit.</p>}
        </div>
      </section>
    );
  };

  const completedItems = items.filter((item) => item.stage === 'done');

  return (
    <div className="space-y-8 pb-4">
      <header className={cn(glassSectionClass, 'flex items-start justify-between rounded-2xl p-5')}>
        <div>
          <h2 className="text-3xl font-light tracking-tight text-slate-900">🗺 Personal Roadmap</h2>
          <p className="mt-2 text-xs tracking-wide text-slate-600">Last updated: {formatMonth(lastUpdated)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(glassToolbarClass, 'inline-flex rounded-xl p-0.5 text-xs')}>
            <button
              onClick={() => setViewMode('list')}
              className={cn('rounded px-2 py-1', viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600')}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={cn('rounded px-2 py-1', viewMode === 'timeline' ? 'bg-slate-900 text-white' : 'text-slate-600')}
            >
              Timeline View
            </button>
          </div>
          <GlassIconButton onClick={() => addItem('next')} title="Add item" aria-label="Add item">
            <Plus className="h-4 w-4" />
          </GlassIconButton>
        </div>
      </header>

      {nowCount > MAX_NOW_ITEMS && <p className="text-xs text-amber-600">Now 阶段建议保持 1~{MAX_NOW_ITEMS} items，当前已超出，请适当收敛。</p>}

      {viewMode === 'timeline' ? (
        <section className={cn(glassSectionClass, 'space-y-3 rounded-2xl border-white/60 pt-6')}>
          {timelineItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <span className="w-16 text-neutral-500">{item.month}</span>
              <span className="text-neutral-800">— {item.title}</span>
            </div>
          ))}
          {timelineItems.length === 0 && <p className="text-xs text-neutral-400">暂无可展示的节奏节点。</p>}
        </section>
      ) : (
        <div className="space-y-10">
          {renderStage('now')}
          {renderStage('next')}
          {renderStage('later')}

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs tracking-[0.2em] text-neutral-500 font-semibold">DONE ({doneCount})</span>
              <GlassIconButton onClick={() => setShowDone((prev) => !prev)} title={showDone ? 'Collapse done' : 'Expand done'} aria-label={showDone ? 'Collapse done' : 'Expand done'}>
                {showDone ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </GlassIconButton>
            </div>
            {showDone && (
              <div className="space-y-2">
                {completedItems.map((item) => renderItem(item))}
                {completedItems.length === 0 && <p className="text-xs text-neutral-400 py-2">No completed items yet.</p>}
              </div>
            )}
          </section>
        </div>
      )}

      <footer className={cn(glassSectionClass, 'flex flex-wrap gap-x-6 gap-y-1 rounded-2xl border-white/60 pt-4 text-sm text-slate-600')}>
        <span>Completed this year: {doneCount} items</span>
        <span>Average cycle: 18 days</span>
      </footer>
    </div>
  );
}
