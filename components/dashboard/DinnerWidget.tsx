import { useState, useEffect, useCallback, useRef } from 'react';
import { UtensilsCrossed, TrendingUp, Users, Award, ChevronLeft, ChevronRight, RefreshCw, Clock, CalendarDays, ChevronsDownUp, ChevronsUpDown, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { httpClient } from '@/lib/httpClient';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ParsedDinnerData, DinnerUserData } from '@/lib/dinner/types';
import { isNonWorkingDay } from '@/lib/chinese-holidays';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { ApplyButtons } from './dinner/ApplyButtons';
import { DailyDetailModal } from './dinner/DailyDetailModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DinnerWidgetProps {
  className?: string;
}

interface AutoApplyTask {
  id: string;
  scheduleDate: string;
  time: string;
  times: number;
}

const AUTO_APPLY_TIME_MIN = '19:00';

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTimeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeKey(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function isValidTimes(value: number): boolean {
  return value === 1 || value === 2;
}

function isAllowedAutoApplyWindow(scheduleDate: string, time: string): boolean {
  if (!isValidDateKey(scheduleDate) || !isValidTimeKey(time)) return false;

  const [year, month, day] = scheduleDate.split('-').map(Number);
  if (isNonWorkingDay(year, month, day)) {
    return true;
  }

  return time >= AUTO_APPLY_TIME_MIN;
}

function sortAutoApplyTasks(tasks: AutoApplyTask[]): AutoApplyTask[] {
  return [...tasks].sort((a, b) => {
    if (a.scheduleDate !== b.scheduleDate) return a.scheduleDate.localeCompare(b.scheduleDate);
    return a.time.localeCompare(b.time);
  });
}

function normalizeAutoApplyTasks(tasks: AutoApplyTask[], now: Date): AutoApplyTask[] {
  const todayKey = formatLocalDateKey(now);
  const currentTimeKey = formatLocalTimeKey(now);
  const unique = new Map<string, AutoApplyTask>();

  for (const task of tasks) {
    if (
      !task ||
      typeof task.id !== 'string' ||
      !isValidDateKey(task.scheduleDate) ||
      !isValidTimeKey(task.time) ||
      !isValidTimes(task.times) ||
      !isAllowedAutoApplyWindow(task.scheduleDate, task.time)
    ) {
      continue;
    }

    const isExpired = task.scheduleDate < todayKey || (task.scheduleDate === todayKey && task.time < currentTimeKey);
    if (isExpired) continue;
    unique.set(task.id, task);
  }

  return sortAutoApplyTasks(Array.from(unique.values()));
}

function loadAutoApplyTasks(): AutoApplyTask[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem('dinner_autoApplyTasks');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const tasks = parsed
      .filter((task): task is AutoApplyTask => (
        task &&
        typeof task.id === 'string' &&
        typeof task.scheduleDate === 'string' &&
        typeof task.time === 'string' &&
        typeof task.times === 'number'
      ))
      .map(task => ({
        id: task.id,
        scheduleDate: task.scheduleDate,
        time: task.time,
        times: task.times,
      }));

    return normalizeAutoApplyTasks(tasks, new Date());
  } catch {
    return [];
  }
}

function mergeMonthsData(months: ParsedDinnerData[], currentUserName?: string): ParsedDinnerData | null {
  if (months.length === 0) return null;
  if (months.length === 1) return months[0];

  const userMap = new Map<string, DinnerUserData>();
  for (const m of months) {
    for (const u of m.allUsers) {
      const key = u.employeeNo || u.name;
      const existing = userMap.get(key);
      if (existing) {
        existing.monthTotal += u.monthTotal;
      } else {
        userMap.set(key, { ...u, dailyRecords: [], monthTotal: u.monthTotal });
      }
    }
  }

  const allUsers = Array.from(userMap.values());
  const sorted = [...allUsers].sort((a, b) => b.monthTotal - a.monthTotal);
  const rankMap = new Map<string, number>();
  sorted.forEach((u, i) => rankMap.set(u.employeeNo, i + 1));

  const currentUser = currentUserName ? allUsers.find(u => u.name === currentUserName) || null : null;
  const currentUserRank = currentUser ? (rankMap.get(currentUser.employeeNo) || null) : null;
  const totals = allUsers.map(u => u.monthTotal);
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const sortedTotals = [...totals].sort((a, b) => a - b);
  const mid = Math.floor(sortedTotals.length / 2);

  const labels = months.map(m => `${m.year}-${m.month.padStart(2, '0')}`);

  return {
    currentUser,
    allUsers,
    totalUsers: allUsers.length,
    currentUserRank,
    daysInMonth: 0,
    year: labels.join(', '),
    month: '',
    statistics: {
      maxTotal: totals.length > 0 ? Math.max(...totals) : 0,
      minTotal: totals.length > 0 ? Math.min(...totals) : 0,
      avgTotal: totals.length > 0 ? grandTotal / totals.length : 0,
      medianTotal: sortedTotals.length % 2 !== 0 ? sortedTotals[mid] : sortedTotals.length > 0 ? (sortedTotals[mid - 1] + sortedTotals[mid]) / 2 : 0,
      grandTotal,
    },
  };
}

export function DinnerWidget({ className = '' }: DinnerWidgetProps) {
  const { user } = useUser();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [monthsData, setMonthsData] = useState<Map<string, ParsedDinnerData>>(new Map());
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [multiMode, setMultiMode] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [autoApplyDraftDate, setAutoApplyDraftDate] = useLocalStorageState('dinner_autoApplyDraftDate', '');
  const [autoApplyDraftTime, setAutoApplyDraftTime] = useLocalStorageState('dinner_autoApplyDraftTime', '20:00');
  const [autoApplyDraftTimes, setAutoApplyDraftTimes] = useLocalStorageState('dinner_autoApplyDraftTimes', 1);
  const [autoApplyTasks, setAutoApplyTasks] = useState<AutoApplyTask[]>(() => loadAutoApplyTasks());
  const [showDailyDetail, setShowDailyDetail] = useState(false);
  const keyBuffer = useRef('');
  const autoApplyTimer = useRef<NodeJS.Timeout | null>(null);
  const autoApplyTasksRef = useRef<AutoApplyTask[]>(autoApplyTasks);
  autoApplyTasksRef.current = autoApplyTasks;
  const autoApplyInFlightRef = useRef<string | null>(null);
  const applyingRef = useRef(false);
  applyingRef.current = applying;

  const currentKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;
  const todayKey = formatLocalDateKey(now);
  const currentTimeKey = formatLocalTimeKey(now);

  // Apply allowed: non-working day (holiday/weekend) all day, working day after 19:00
  const canApplyNow = (() => {
    const todayIsOff = isNonWorkingDay(now.getFullYear(), now.getMonth() + 1, now.getDate());
    if (todayIsOff) return true;
    return now.getHours() >= 19;
  })();

  // Fetch data for a specific month
  const fetchMonth = useCallback(async (year: number, month: number, cacheOnly = false) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    try {
      const result = await httpClient<ParsedDinnerData>('/api/dinner', {
        params: { userName: user?.realName, year, month, cacheOnly: cacheOnly ? 'true' : undefined },
      });
      if (result && result.totalUsers > 0) {
        setMonthsData(prev => new Map(prev).set(key, result));
      }
      return result;
    } catch {
      return null;
    }
  }, [user?.realName]);

  // Initial load + auto-refresh
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMonth(selectedYear, selectedMonth);
        if (!result || result.totalUsers === 0) {
          setError('No data');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();

    // Auto-refresh every hour (current month only)
    const interval = setInterval(() => {
      const n = new Date();
      fetchMonth(n.getFullYear(), n.getMonth() + 1);
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMonth, selectedYear, selectedMonth]);

  // Month navigation
  const goMonth = (delta: number) => {
    let y = selectedYear, m = selectedMonth + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedYear(y);
    setSelectedMonth(m);
    setMultiMode(false);
    setSelectedMonths(new Set());
  };

  // Toggle month in multi-select
  const toggleMonth = (key: string) => {
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Get display data
  const getDisplayData = (): ParsedDinnerData | null => {
    if (multiMode && selectedMonths.size > 0) {
      const datas = Array.from(selectedMonths)
        .map(k => monthsData.get(k))
        .filter(Boolean) as ParsedDinnerData[];
      return mergeMonthsData(datas, user?.realName);
    }
    return monthsData.get(currentKey) || null;
  };

  const data = getDisplayData();

  const handleApply = useCallback(async (date: number, times: number) => {
    setApplying(true);
    try {
      await httpClient<any>('/api/dinner/apply', {
        method: 'POST',
        body: { date, times },
      });
      toast.success(`申报成功: ${date === 0 ? '今天' : '昨天'} ${times}次`);
      const n = new Date();
      fetchMonth(n.getFullYear(), n.getMonth() + 1);
    } catch (err: any) {
      toast.error(`申报失败: ${err.message}`);
    } finally {
      setApplying(false);
    }
  }, [fetchMonth]);

  const handleAddAutoApplyTask = () => {
    if (!autoApplyDraftDate || !autoApplyDraftTime) {
      toast.error('请先选日期和时间');
      return;
    }

    if (autoApplyDraftDate < todayKey || (autoApplyDraftDate === todayKey && autoApplyDraftTime <= currentTimeKey)) {
      toast.error('今天的自动申报必须晚于当前分钟，避免立即触发');
      return;
    }

    if (!isAllowedAutoApplyWindow(autoApplyDraftDate, autoApplyDraftTime)) {
      toast.error('工作日自动申报只能设置在 19:00 及之后');
      return;
    }

    const taskId = `${autoApplyDraftDate} ${autoApplyDraftTime}`;
    if (autoApplyTasks.some(task => task.id === taskId)) {
      toast.error('同一日期和时间只能保留一个待执行任务');
      return;
    }

    const nextTask: AutoApplyTask = {
      id: taskId,
      scheduleDate: autoApplyDraftDate,
      time: autoApplyDraftTime,
      times: autoApplyDraftTimes,
    };

    setAutoApplyTasks(prev => sortAutoApplyTasks([...prev, nextTask]));
    setAutoApplyDraftDate('');
    toast.success('已添加到待执行任务');
  };

  const handleDeleteAutoApplyTask = (taskId: string) => {
    setAutoApplyTasks(prev => prev.filter(task => task.id !== taskId));
  };

  // Secret code listener: AAABBB
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      keyBuffer.current += e.key.toUpperCase();
      if (keyBuffer.current.length > 10) {
        keyBuffer.current = keyBuffer.current.slice(-10);
      }
      if (keyBuffer.current.includes('AAABBB')) {
        setShowSecret(true);
        keyBuffer.current = '';
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-apply scheduler: use refs to avoid dependency churn
  const handleApplyRef = useRef(handleApply);
  handleApplyRef.current = handleApply;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('dinner_autoApplyTasks', JSON.stringify(autoApplyTasks));
  }, [autoApplyTasks]);

  useEffect(() => {
    setAutoApplyTasks(prev => normalizeAutoApplyTasks(prev, new Date()));
  }, []);

  useEffect(() => {
    if (autoApplyTimer.current) clearInterval(autoApplyTimer.current);

    const check = () => {
      const n = new Date();
      const normalizedTasks = normalizeAutoApplyTasks(autoApplyTasksRef.current, n);

      if (normalizedTasks.length !== autoApplyTasksRef.current.length) {
        setAutoApplyTasks(normalizedTasks);
      }

      if (normalizedTasks.length === 0) {
        return;
      }

      const dueTask = normalizedTasks.find(task => (
        task.scheduleDate === formatLocalDateKey(n) &&
        task.time === formatLocalTimeKey(n)
      ));

      if (!dueTask || autoApplyInFlightRef.current === dueTask.id || applyingRef.current) {
        return;
      }

      if (!isAllowedAutoApplyWindow(dueTask.scheduleDate, dueTask.time)) {
        setAutoApplyTasks(prev => prev.filter(task => task.id !== dueTask.id));
        return;
      }

      autoApplyInFlightRef.current = dueTask.id;
      setAutoApplyTasks(prev => prev.filter(task => task.id !== dueTask.id));

      void handleApplyRef.current(0, dueTask.times).finally(() => {
        autoApplyInFlightRef.current = null;
      });
    };

    // Check immediately, then every 15 seconds to not miss the minute window
    check();
    autoApplyTimer.current = setInterval(check, 15 * 1000);

    return () => { if (autoApplyTimer.current) clearInterval(autoApplyTimer.current); };
  }, [autoApplyTasks]);

  // Bar chart data
  const barChartData = data && data.allUsers.length > 0
    ? [...data.allUsers].sort((a, b) => b.monthTotal - a.monthTotal).map(u => ({
        name: u.name,
        total: u.monthTotal,
        isCurrentUser: data.currentUser?.employeeNo === u.employeeNo,
      }))
    : [];

  // Available months for multi-select (from cache keys)
  const availableMonths: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    availableMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold leading-none">Dinner Subsidy</h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-3 text-xs"
          onClick={() => setDetailsExpanded(prev => !prev)}
          aria-expanded={detailsExpanded}
          aria-label={detailsExpanded ? '收起 Dinner Subsidy 详情' : '展开 Dinner Subsidy 详情'}
        >
          {detailsExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
          {detailsExpanded ? '收起详情' : '展开详情'}
        </Button>
      </div>

      <CardContent className="p-4">
        {loading && !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            {detailsExpanded && <Skeleton className="h-48" />}
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <Button variant="link" onClick={() => fetchMonth(selectedYear, selectedMonth)} className="mt-2 h-auto p-0">
              Retry
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md">
                <div className="mb-1 flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                  <span className="text-xs font-medium text-muted-foreground">My Count</span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{data.currentUser?.monthTotal ?? '-'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{data.currentUser?.employeeNo || 'Not found'}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md">
                <div className="mb-1 flex items-center gap-2">
                  <Award className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground">My Rank</span>
                </div>
                <p className="text-2xl font-bold tracking-tight text-primary">
                  {data.currentUserRank ? `#${data.currentUserRank}` : '-'}
                </p>
                <p className="text-[10px] text-muted-foreground">of {data.totalUsers} people</p>
              </div>
              <div className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md">
                <div className="mb-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium text-muted-foreground">Average</span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{data.statistics.avgTotal.toFixed(1)}</p>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Max: {data.statistics.maxTotal}</span>
                  <span>Med: {data.statistics.medianTotal}</span>
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md">
                <div className="mb-1 flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-medium text-muted-foreground">Team Total</span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{data.statistics.grandTotal}</p>
                <p className="text-[10px] text-muted-foreground">{data.totalUsers} people</p>
              </div>
            </div>

            {detailsExpanded && (
              <>
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">当前月份</span>
                    <span className="rounded-md bg-background px-2 py-1 font-mono text-xs">
                      {selectedYear}-{String(selectedMonth).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => goMonth(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => goMonth(1)} disabled={isCurrentMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={multiMode ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => { setMultiMode(!multiMode); setSelectedMonths(new Set()); }}
                      className={cn("h-9 text-xs", multiMode && "text-primary")}
                    >
                      Multi
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground"
                      onClick={() => setShowDailyDetail(true)}
                      title="Daily Detail"
                    >
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground"
                      onClick={() => fetchMonth(selectedYear, selectedMonth)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {multiMode && (
                  <div className="rounded-lg border bg-muted/30 p-2">
                    <div className="flex flex-wrap gap-1">
                      {availableMonths.map(key => (
                        <Badge
                          key={key}
                          variant={selectedMonths.has(key) ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer hover:bg-primary/20",
                            !selectedMonths.has(key) && "bg-background hover:text-primary"
                          )}
                          onClick={() => {
                            toggleMonth(key);
                            const [y, m] = key.split('-').map(Number);
                            if (!monthsData.has(key)) fetchMonth(y, m);
                          }}
                        >
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Apply Section - only current month + time restrictions */}
                {isCurrentMonth && canApplyNow && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    <span className="text-sm font-medium text-muted-foreground">Apply:</span>
                    <div className="flex-1">
                      <ApplyButtons onApply={handleApply} disabled={applying} />
                    </div>
                  </div>
                )}

            {/* Bar Chart */}
            {barChartData.length > 0 && (
              <div className="rounded-lg border p-4">
                <h4 className="mb-4 text-sm font-medium text-muted-foreground">
                  {multiMode && selectedMonths.size > 1 ? 'Cumulative Ranking' : 'Monthly Ranking'}
                </h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ bottom: 60, top: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} 
                        angle={-45} 
                        textAnchor="end" 
                        interval={0} 
                        height={60} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} 
                        allowDecimals={false} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))", 
                          borderColor: "hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          fontSize: "12px"
                        }}
                        formatter={(value: number) => [`${value} times`, 'Count']} 
                      />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {barChartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.isCurrentUser ? "hsl(var(--primary))" : "hsl(var(--muted))"} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {barChartData.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Top 10</h4>
                <div className="grid gap-2">
                  {barChartData.slice(0, 10).map((u, index) => (
                    <div
                      key={`${u.name}-${index}`}
                      className={cn(
                        "flex items-center justify-between rounded-md border p-2 transition-colors",
                        u.isCurrentUser ? "border-primary/30 bg-primary/5" : "bg-card hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                          index === 0 ? "bg-yellow-100 text-yellow-700" :
                          index === 1 ? "bg-slate-100 text-slate-700" :
                          index === 2 ? "bg-amber-100 text-amber-700" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className={cn(
                            "text-sm font-medium",
                            u.isCurrentUser ? "text-primary" : "text-foreground"
                          )}>
                            {u.name}
                            {u.isCurrentUser && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(You)</span>}
                          </span>
                        </div>
                      </div>
                      <span className={cn(
                        "font-mono text-sm font-bold",
                        u.isCurrentUser ? "text-primary" : "text-muted-foreground"
                      )}>
                        {u.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hidden Auto-Apply Section */}
            {showSecret && (
              <div className="mt-4 rounded-lg border border-dashed border-destructive/50 bg-destructive/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-semibold">Auto Apply (Secret)</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowSecret(false)} className="h-6 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
                    Hide
                  </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                  <label className="space-y-2 text-xs font-medium text-foreground">
                    <span className="block">日期</span>
                    <input
                      type="date"
                      min={todayKey}
                      value={autoApplyDraftDate}
                      onChange={e => setAutoApplyDraftDate(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-destructive focus:ring-2 focus:ring-destructive/20"
                    />
                  </label>
                  <label className="space-y-2 text-xs font-medium text-foreground">
                    <span className="block">时间</span>
                    <input
                      type="time"
                      value={autoApplyDraftTime}
                      onChange={e => setAutoApplyDraftTime(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-destructive focus:ring-2 focus:ring-destructive/20"
                    />
                  </label>
                  <label className="space-y-2 text-xs font-medium text-foreground">
                    <span className="block">次数</span>
                    <select
                      value={autoApplyDraftTimes}
                      onChange={e => setAutoApplyDraftTimes(Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value={1}>1 次</option>
                      <option value={2}>2 次</option>
                    </select>
                  </label>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 lg:w-auto"
                      onClick={handleAddAutoApplyTask}
                    >
                      确认添加
                    </Button>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-destructive/20 bg-background/80 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">待执行任务</span>
                    <Badge variant="outline" className="text-xs">
                      {autoApplyTasks.length}
                    </Badge>
                  </div>

                  {autoApplyTasks.length > 0 ? (
                    <div className="space-y-2">
                      {autoApplyTasks.map(task => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between rounded-md border border-border/70 bg-background px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {task.scheduleDate} {task.time}
                            </p>
                            <p className="text-xs text-muted-foreground">今天 {task.times} 次</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteAutoApplyTask(task.id)}
                            aria-label={`删除任务 ${task.scheduleDate} ${task.time}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无待执行任务</p>
                  )}
                </div>
              </div>
            )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <UtensilsCrossed className="mb-2 h-10 w-10 opacity-20" />
            <p className="text-sm">No data available</p>
          </div>
        )}
      </CardContent>
      {showDailyDetail && data && data.daysInMonth > 0 && !multiMode && (
        <DailyDetailModal
          data={data}
          year={selectedYear}
          month={selectedMonth}
          onClose={() => setShowDailyDetail(false)}
        />
      )}
    </Card>
  );
}
