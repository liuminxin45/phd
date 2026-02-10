import { useState, useEffect, useCallback, useRef } from 'react';
import { UtensilsCrossed, TrendingUp, Users, Award, ChevronLeft, ChevronRight, RefreshCw, Clock, CalendarDays } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DinnerWidgetProps {
  className?: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [autoApplyEnabled, setAutoApplyEnabled] = useLocalStorageState('dinner_autoApplyEnabled', false);
  const [autoApplyTime, setAutoApplyTime] = useLocalStorageState('dinner_autoApplyTime', '20:00');
  const [autoApplyDate, setAutoApplyDate] = useLocalStorageState('dinner_autoApplyDate', 0);
  const [autoApplyTimes, setAutoApplyTimes] = useLocalStorageState('dinner_autoApplyTimes', 1);
  const [showDailyDetail, setShowDailyDetail] = useState(false);
  const keyBuffer = useRef('');
  const autoApplyTimer = useRef<NodeJS.Timeout | null>(null);
  const lastAutoApplyMinute = useRef('');

  const currentKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

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
  const autoApplyDateRef = useRef(autoApplyDate);
  autoApplyDateRef.current = autoApplyDate;
  const autoApplyTimesRef = useRef(autoApplyTimes);
  autoApplyTimesRef.current = autoApplyTimes;
  const autoApplyTimeRef = useRef(autoApplyTime);
  autoApplyTimeRef.current = autoApplyTime;

  useEffect(() => {
    if (autoApplyTimer.current) clearInterval(autoApplyTimer.current);
    if (!autoApplyEnabled) return;

    const check = () => {
      const n = new Date();
      const timeStr = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
      if (timeStr === autoApplyTimeRef.current && lastAutoApplyMinute.current !== timeStr) {
        lastAutoApplyMinute.current = timeStr;
        handleApplyRef.current(autoApplyDateRef.current, autoApplyTimesRef.current);
        setAutoApplyEnabled(false);
      }
    };

    // Check immediately, then every 15 seconds to not miss the minute window
    check();
    autoApplyTimer.current = setInterval(check, 15 * 1000);

    return () => { if (autoApplyTimer.current) clearInterval(autoApplyTimer.current); };
  }, [autoApplyEnabled]);

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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[80px] text-center text-sm font-medium tabular-nums">
            {selectedYear}-{String(selectedMonth).padStart(2, '0')}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(1)} disabled={isCurrentMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant={multiMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => { setMultiMode(!multiMode); setSelectedMonths(new Set()); }}
            className={cn("ml-2 h-8 text-xs", multiMode && "text-primary")}
          >
            Multi
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-8 w-8 text-muted-foreground"
            onClick={() => setShowDailyDetail(true)}
            title="Daily Detail"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-1 h-8 w-8 text-muted-foreground" 
            onClick={() => fetchMonth(selectedYear, selectedMonth)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Multi-month selector */}
      {multiMode && (
        <div className="border-b bg-muted/30 p-2">
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

      <CardContent className="p-4">
        {loading && !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-48" />
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
            {/* Apply Section - only current month + time restrictions */}
            {isCurrentMonth && canApplyNow && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <span className="text-sm font-medium text-muted-foreground">Apply:</span>
                <div className="flex-1">
                  <ApplyButtons onApply={handleApply} disabled={applying} />
                </div>
              </div>
            )}

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
                
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoApplyEnabled}
                      onChange={e => setAutoApplyEnabled(e.target.checked)}
                      className="rounded border-destructive text-destructive focus:ring-destructive"
                    />
                    <span className="font-medium">Enable</span>
                  </label>
                  
                  <div className="flex items-center gap-2">
                    <span>Time:</span>
                    <input
                      type="time"
                      value={autoApplyTime}
                      onChange={e => setAutoApplyTime(e.target.value)}
                      className="h-6 rounded border border-input bg-background px-1 text-xs"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span>Date:</span>
                    <select
                      value={autoApplyDate}
                      onChange={e => setAutoApplyDate(Number(e.target.value))}
                      className="h-6 rounded border border-input bg-background px-1 text-xs"
                    >
                      <option value={0}>Today</option>
                      <option value={-1}>Yesterday</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span>Times:</span>
                    <select
                      value={autoApplyTimes}
                      onChange={e => setAutoApplyTimes(Number(e.target.value))}
                      className="h-6 rounded border border-input bg-background px-1 text-xs"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </div>
                </div>
                
                {autoApplyEnabled && (
                  <p className="mt-2 text-[10px] text-green-600 font-medium">
                    Active - {autoApplyDate === 0 ? 'today' : 'yesterday'} {autoApplyTimes}x at {autoApplyTime}
                  </p>
                )}
                
                <div className="mt-3 flex items-center gap-2 border-t border-destructive/20 pt-3">
                  <span className="text-xs font-medium text-destructive">Manual Override:</span>
                  <ApplyButtons onApply={handleApply} disabled={applying} showIcon={false} variant="danger" />
                </div>
              </div>
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
