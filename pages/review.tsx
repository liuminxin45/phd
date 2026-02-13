import { useState, useEffect, useCallback, useRef } from 'react';
import { httpGet } from '@/lib/httpClient';
import type { DashboardResponse, DashboardSection, GerritChange } from '@/lib/gerrit/types';
import { relativeTime, getAccountName } from '@/lib/gerrit/helpers';
import { ChangeCard } from '@/components/review/ChangeCard';
import { ChangeDetail } from '@/components/review/ChangeDetail';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  GitPullRequest,
  Search,
  RefreshCw,
  Loader2,
  Inbox,
  Send,
  Mail,
  GitMerge,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Keyboard,
} from 'lucide-react';

const GERRIT_URL = 'https://review.tp-link.net/gerrit';

const SECTION_ICONS: Record<string, typeof Inbox> = {
  '待我评审': Inbox,
  '我发起的': Send,
  '抄送我的': Mail,
  '最近合入': GitMerge,
};

const SECTION_COLORS: Record<string, string> = {
  '待我评审': 'border-l-amber-400',
  '我发起的': 'border-l-blue-400',
  '抄送我的': 'border-l-purple-400',
  '最近合入': 'border-l-green-400',
};

type ViewState = 'dashboard' | 'detail' | 'search';

export default function ReviewPage() {
  // ── View navigation ─────────────────────────────────
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedChangeNumber, setSelectedChangeNumber] = useState<number | null>(null);

  // ── Dashboard data ──────────────────────────────────
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Search ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GerritChange[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // ── Collapsed sections ──────────────────────────────
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['最近合入', '抄送我的']));

  // ── Auto-refresh ────────────────────────────────────
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Keyboard navigation ─────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setDashboardError(null);
    try {
      const res = await httpGet<DashboardResponse>('/api/gerrit/dashboard');
      setDashboard(res);
      setLastRefresh(new Date());
    } catch (err: any) {
      setDashboardError(err.message || 'Failed to fetch dashboard');
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  // Initial load + auto-refresh every 60s
  useEffect(() => {
    fetchDashboard();
    refreshIntervalRef.current = setInterval(fetchDashboard, 60_000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [fetchDashboard]);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setHasSearched(true);
    try {
      const res = await httpGet<{ changes: GerritChange[] }>('/api/gerrit/changes', { q: searchQuery.trim() });
      setSearchResults(res.changes || []);
      setView('search');
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === 'Escape') {
      setSearchQuery('');
      if (view === 'search') setView('dashboard');
    }
  };

  // Open change detail
  const openChange = useCallback((change: GerritChange) => {
    setSelectedChangeNumber(change._number);
    setView('detail');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Only in dashboard view
      if (view !== 'dashboard') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '/') {
        e.preventDefault();
        const input = document.querySelector('[data-review-search]') as HTMLInputElement;
        input?.focus();
      }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        fetchDashboard();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [view, fetchDashboard]);

  // Toggle section collapse
  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  // Compute stats
  const stats = dashboard ? {
    incoming: dashboard.sections.find((s) => s.title === '待我评审')?.changes.length || 0,
    outgoing: dashboard.sections.find((s) => s.title === '我发起的')?.changes.length || 0,
    cced: dashboard.sections.find((s) => s.title === '抄送我的')?.changes.length || 0,
    merged: dashboard.sections.find((s) => s.title === '最近合入')?.changes.length || 0,
  } : null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Change detail view
  if (view === 'detail' && selectedChangeNumber) {
    return (
      <div className="h-full overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          <ChangeDetail
            changeNumber={selectedChangeNumber}
            gerritUrl={GERRIT_URL}
            onBack={() => setView(hasSearched && searchResults.length > 0 ? 'search' : 'dashboard')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-5">

        {/* ── Header ────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                  <GitPullRequest className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">代码评审</h1>
                  <p className="text-xs text-muted-foreground">
                    Gerrit Code Review
                    {dashboard?.account && (
                      <span className="ml-2">· {getAccountName(dashboard.account)}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative w-72">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    data-review-search
                    type="text"
                    placeholder="搜索 (Gerrit query 语法, 按 / 聚焦)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                {/* Refresh */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchDashboard}
                  disabled={loadingDashboard}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingDashboard && 'animate-spin')} />
                  刷新
                </Button>

                {/* External link */}
                <a href={`${GERRIT_URL}/dashboard/self`}>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Gerrit
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Search results view ──────────────────────────────── */}
        {view === 'search' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setView('dashboard')}>← Dashboard</Button>
                <span className="text-sm text-muted-foreground">
                  搜索 &ldquo;{searchQuery}&rdquo; · {searchResults.length} 个结果
                </span>
              </div>
            </div>
            {searchLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">搜索中...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid gap-2">
                {searchResults.map((change) => (
                  <ChangeCard key={change._number} change={change} onClick={() => openChange(change)} gerritUrl={GERRIT_URL} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">无匹配结果</div>
            )}
          </>
        )}

        {/* ── Dashboard view ───────────────────────────────────── */}
        {view === 'dashboard' && (
          <>
            {/* Stats bar */}
            {stats && !loadingDashboard && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '待我评审', value: stats.incoming, icon: Inbox, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: '我发起的', value: stats.outgoing, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: '抄送我的', value: stats.cced, icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: '最近合入', value: stats.merged, icon: GitMerge, color: 'text-green-600', bg: 'bg-green-50' },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <Card key={stat.label} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => {
                      if (collapsedSections.has(stat.label)) toggleSection(stat.label);
                      // Scroll to section
                      document.getElementById(`section-${stat.label}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', stat.bg)}>
                          <Icon className={cn('h-4 w-4', stat.color)} />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-foreground">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Last refresh indicator */}
            {lastRefresh && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <Clock className="h-3 w-3" />
                上次刷新: {lastRefresh.toLocaleTimeString()} · 每 60 秒自动刷新
                <span className="ml-2">
                  <Keyboard className="h-3 w-3 inline" /> <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">/</kbd> 搜索 · <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">r</kbd> 刷新
                </span>
              </div>
            )}

            {/* Loading state */}
            {loadingDashboard && !dashboard && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">加载 Gerrit Dashboard...</span>
              </div>
            )}

            {/* Error state */}
            {dashboardError && !dashboard && (
              <Card className="border-red-200">
                <CardContent className="p-6 text-center space-y-3">
                  <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
                  <p className="text-sm text-red-600">{dashboardError}</p>
                  <p className="text-xs text-muted-foreground">请检查 GERRIT_URL、LOGIN_USER、LOGIN_PASS 是否配置正确</p>
                  <Button variant="outline" size="sm" onClick={fetchDashboard}>重试</Button>
                </CardContent>
              </Card>
            )}

            {/* Dashboard sections */}
            {dashboard && dashboard.sections.map((section) => {
              const Icon = SECTION_ICONS[section.title] || Inbox;
              const borderColor = SECTION_COLORS[section.title] || 'border-l-neutral-400';
              const isCollapsed = collapsedSections.has(section.title);
              const isEmpty = section.changes.length === 0;

              return (
                <div key={section.title} id={`section-${section.title}`}>
                  <Card className={cn('border-l-3', borderColor)}>
                    <CardContent className="p-0">
                      {/* Section header */}
                      <button
                        onClick={() => toggleSection(section.title)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{section.title}</span>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {section.changes.length}
                          </Badge>
                        </div>
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {/* Section content */}
                      {!isCollapsed && (
                        <div className="border-t border-border">
                          {isEmpty ? (
                            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                              暂无变更
                            </div>
                          ) : (
                            <div className="p-3 grid gap-2">
                              {section.changes.map((change) => (
                                <ChangeCard
                                  key={change._number}
                                  change={change}
                                  onClick={() => openChange(change)}
                                  gerritUrl={GERRIT_URL}
                                  showOwner={section.title !== '我发起的'}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
