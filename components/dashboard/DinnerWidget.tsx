import { useState, useEffect, useCallback, useRef } from 'react';
import { UtensilsCrossed, TrendingUp, Users, Award, ChevronLeft, ChevronRight, RefreshCw, Send, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
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
import type { ParsedDinnerData, DinnerUserData } from '@/lib/parsers/dinner-html';

interface DinnerWidgetProps {
  className?: string;
}

// Merge multi-month data: sum monthTotal per user across months
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
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(false);
  const [autoApplyTime, setAutoApplyTime] = useState('20:00');
  const [autoApplyDate, setAutoApplyDate] = useState(0);
  const [autoApplyTimes, setAutoApplyTimes] = useState(1);
  const keyBuffer = useRef('');
  const autoApplyTimer = useRef<NodeJS.Timeout | null>(null);

  const currentKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  // Check if apply is allowed: weekday after 19:00, weekend all day
  const canApplyNow = (() => {
    const day = now.getDay(); // 0=Sun, 6=Sat
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) return true;
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

  // Apply dinner
  const handleApply = async (date: number, times: number) => {
    setApplying(true);
    try {
      await httpClient<any>('/api/dinner/apply', {
        method: 'POST',
        body: { date, times },
      });
      toast.success(`申报成功: ${date === 0 ? '今天' : '昨天'} ${times}次`);
      // Refresh current month
      fetchMonth(now.getFullYear(), now.getMonth() + 1);
    } catch (err: any) {
      toast.error(`申报失败: ${err.message}`);
    } finally {
      setApplying(false);
    }
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

  // Auto-apply scheduler
  useEffect(() => {
    if (autoApplyTimer.current) clearInterval(autoApplyTimer.current);
    if (!autoApplyEnabled || !showSecret) return;

    autoApplyTimer.current = setInterval(() => {
      const n = new Date();
      const timeStr = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
      if (timeStr === autoApplyTime) {
        handleApply(autoApplyDate, autoApplyTimes);
      }
    }, 60 * 1000);

    return () => { if (autoApplyTimer.current) clearInterval(autoApplyTimer.current); };
  }, [autoApplyEnabled, autoApplyTime, autoApplyDate, autoApplyTimes, showSecret]);

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
    <div className={`bg-white border border-neutral-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-orange-500" />
            <h3 className="text-base font-semibold text-neutral-900">Dinner Subsidy</h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => goMonth(-1)} className="p-1 hover:bg-neutral-100 rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium min-w-[80px] text-center">
              {selectedYear}-{String(selectedMonth).padStart(2, '0')}
            </span>
            <button onClick={() => goMonth(1)} className="p-1 hover:bg-neutral-100 rounded" disabled={isCurrentMonth}>
              <ChevronRight className={`w-4 h-4 ${isCurrentMonth ? 'text-neutral-300' : ''}`} />
            </button>
            <button
              onClick={() => { setMultiMode(!multiMode); setSelectedMonths(new Set()); }}
              className={`ml-2 px-2 py-1 text-xs rounded ${multiMode ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100 text-neutral-600'}`}
            >
              Multi
            </button>
            <button onClick={() => fetchMonth(selectedYear, selectedMonth)} className="p-1 hover:bg-neutral-100 rounded ml-1">
              <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          </div>
        </div>

        {/* Multi-month selector */}
        {multiMode && (
          <div className="flex flex-wrap gap-1 mt-2">
            {availableMonths.map(key => (
              <button
                key={key}
                onClick={() => {
                  toggleMonth(key);
                  const [y, m] = key.split('-').map(Number);
                  if (!monthsData.has(key)) fetchMonth(y, m);
                }}
                className={`px-2 py-1 text-xs rounded border ${
                  selectedMonths.has(key) ? 'bg-orange-100 border-orange-300 text-orange-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
        {loading && !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-48" />
          </div>
        ) : error && !data ? (
          <div className="p-6 text-center">
            <p className="text-sm text-neutral-500">{error}</p>
            <button onClick={() => fetchMonth(selectedYear, selectedMonth)} className="mt-2 text-sm text-blue-600 hover:text-blue-700">Retry</button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Apply Section - only current month + time restrictions */}
            {isCurrentMonth && canApplyNow && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-neutral-500">申报:</span>
                {[
                  { label: '今天1次', date: 0, times: 1 },
                  { label: '今天2次', date: 0, times: 2 },
                  { label: '昨天1次', date: -1, times: 1 },
                  { label: '昨天2次', date: -1, times: 2 },
                  { label: '取消今天', date: 0, times: 0 },
                ].map(({ label, date, times }) => (
                  <button
                    key={label}
                    onClick={() => handleApply(date, times)}
                    disabled={applying}
                    className="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded border border-orange-200 hover:bg-orange-100 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3 inline mr-1" />{label}
                  </button>
                ))}
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <UtensilsCrossed className="w-4 h-4 text-orange-600" />
                  <span className="text-xs text-orange-700">My Count</span>
                </div>
                <p className="text-xl font-bold text-orange-900">{data.currentUser?.monthTotal ?? '-'}</p>
                <p className="text-xs text-orange-600">{data.currentUser?.employeeNo || 'Not found'}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-blue-700">My Rank</span>
                </div>
                <p className="text-xl font-bold text-blue-900">{data.currentUserRank ? `#${data.currentUserRank}` : '-'}</p>
                <p className="text-xs text-blue-600">of {data.totalUsers} people</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700">Average</span>
                </div>
                <p className="text-xl font-bold text-green-900">{data.statistics.avgTotal.toFixed(1)}</p>
                <p className="text-xs text-green-600">Max: {data.statistics.maxTotal} | Med: {data.statistics.medianTotal}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span className="text-xs text-purple-700">Team Total</span>
                </div>
                <p className="text-xl font-bold text-purple-900">{data.statistics.grandTotal}</p>
                <p className="text-xs text-purple-600">{data.totalUsers} people</p>
              </div>
            </div>

            {/* Bar Chart */}
            {barChartData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-neutral-700 mb-3">
                  {multiMode && selectedMonths.size > 1 ? 'Cumulative Ranking' : 'Monthly Ranking'}
                </h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-55} textAnchor="end" interval={0} height={70} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(value: number) => [`${value} times`, 'Count']} />
                      <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isCurrentUser ? '#f97316' : '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {barChartData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-neutral-700 mb-3">Top 10</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {barChartData.slice(0, 10).map((u, index) => (
                    <div
                      key={`${u.name}-${index}`}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        u.isCurrentUser ? 'bg-orange-100 border border-orange-300' : 'bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-yellow-400 text-yellow-900' :
                          index === 1 ? 'bg-gray-300 text-gray-700' :
                          index === 2 ? 'bg-amber-600 text-white' :
                          'bg-neutral-200 text-neutral-600'
                        }`}>{index + 1}</span>
                        <p className={`text-sm font-medium ${u.isCurrentUser ? 'text-orange-900' : 'text-neutral-900'}`}>
                          {u.name}
                          {u.isCurrentUser && <span className="ml-1 text-xs text-orange-600">(You)</span>}
                        </p>
                      </div>
                      <p className={`text-sm font-bold ${u.isCurrentUser ? 'text-orange-700' : 'text-neutral-700'}`}>{u.total}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hidden Auto-Apply Section - always available once secret code entered */}
            {showSecret && (
              <div className="border border-dashed border-red-300 rounded-lg p-3 bg-red-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-semibold text-red-700">Auto Apply</span>
                  <button onClick={() => setShowSecret(false)} className="ml-auto text-xs text-red-400 hover:text-red-600">Hide</button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={autoApplyEnabled}
                      onChange={e => setAutoApplyEnabled(e.target.checked)}
                      className="rounded"
                    />
                    Enable
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    Time:
                    <input
                      type="time"
                      value={autoApplyTime}
                      onChange={e => setAutoApplyTime(e.target.value)}
                      className="border rounded px-1 py-0.5 text-xs w-20"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    Date:
                    <select
                      value={autoApplyDate}
                      onChange={e => setAutoApplyDate(Number(e.target.value))}
                      className="border rounded px-1 py-0.5 text-xs"
                    >
                      <option value={0}>Today</option>
                      <option value={-1}>Yesterday</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    Times:
                    <select
                      value={autoApplyTimes}
                      onChange={e => setAutoApplyTimes(Number(e.target.value))}
                      className="border rounded px-1 py-0.5 text-xs"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </label>
                  {autoApplyEnabled && <span className="text-xs text-green-600">Active - {autoApplyDate === 0 ? 'today' : 'yesterday'} {autoApplyTimes}x at {autoApplyTime}</span>}
                </div>
                {/* Manual apply buttons - always available here */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-red-200">
                  <span className="text-xs text-red-500">Manual:</span>
                  {[
                    { label: '今天1次', date: 0, times: 1 },
                    { label: '今天2次', date: 0, times: 2 },
                    { label: '昨天1次', date: -1, times: 1 },
                    { label: '昨天2次', date: -1, times: 2 },
                    { label: '取消今天', date: 0, times: 0 },
                  ].map(({ label, date, times }) => (
                    <button
                      key={`secret-${label}`}
                      onClick={() => handleApply(date, times)}
                      disabled={applying}
                      className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100 disabled:opacity-50"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-neutral-500">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
