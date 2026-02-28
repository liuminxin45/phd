import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { httpGet } from '@/lib/httpClient';
import type { DashboardResponse, GerritChange } from '@/lib/gerrit/types';
import { getAccountName, normalizeQueryInput } from '@/lib/gerrit/helpers';
import { useAutoAiMonitor } from '@/hooks/useAutoAiMonitor';
import { ChangeCard } from '@/components/review/ChangeCard';
import { ChangeDetail } from '@/components/review/ChangeDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Sparkles
} from 'lucide-react';

const DEFAULT_GERRIT_URL = 'https://review.tp-link.net/gerrit';
const REVIEW_COLLAPSED_SECTIONS_KEY = 'review-collapsed-sections-v1';
const REVIEW_UNREAD_CHANGE_IDS_KEY = 'review-unread-change-ids-v1';
const FIRST_ENTRY_COLLAPSED_SECTIONS = [
  'Outgoing Reviews',
  'Incoming Reviews',
  'CC\'ed On',
  'Recently Closed',
  'Recently Merged',
  '我发起的',
  '待我评审',
  '抄送我的',
  '最近关闭',
  '最近合入',
];

const SECTION_ICONS: Record<string, typeof Inbox> = {
  'Your Turn': AlertCircle,
  'Incoming Reviews': Inbox,
  'Outgoing Reviews': Send,
  'CC\'ed On': Mail,
  'Recently Closed': GitMerge,
  'Recently Merged': GitMerge,
  // Fallbacks for legacy Chinese titles if API not updated immediately
  '轮到我处理': AlertCircle,
  '待我评审': Inbox,
  '我发起的': Send,
  '抄送我的': Mail,
  '最近关闭': GitMerge,
  '最近合入': GitMerge,
};

// Map legacy Chinese titles to English for display
const SECTION_TITLES: Record<string, string> = {
  '轮到我处理': 'Your Turn',
  '待我评审': 'Incoming Reviews',
  '我发起的': 'Outgoing Reviews',
  '抄送我的': 'CC\'ed On',
  '最近关闭': 'Recently Closed',
  'Recently Merged': 'Recently Closed',
  '最近合入': 'Recently Merged',
};

const SECTION_ORDER = ['Your Turn', 'Outgoing Reviews', 'Incoming Reviews', 'CC\'ed On', 'Recently Closed'];

function normalizeSectionTitle(title: string): string {
  return SECTION_TITLES[title] || title;
}

function buildChangeSignature(change: GerritChange): string {
  return [
    change.current_revision || '',
    change.updated || '',
    String(change.insertions || 0),
    String(change.deletions || 0),
  ].join('|');
}

type ViewState = 'dashboard' | 'detail' | 'search';

export default function ReviewPage() {
  const router = useRouter();
  // ── View navigation ─────────────────────────────────
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedChangeNumber, setSelectedChangeNumber] = useState<number | null>(null);

  // ── Config ────────────────────────────────────────────
  const [gerritUrl, setGerritUrl] = useState(DEFAULT_GERRIT_URL);

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
  const [unreadChangeIds, setUnreadChangeIds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(REVIEW_UNREAD_CHANGE_IDS_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((item): item is number => Number.isFinite(item)).map((n) => Number(n)));
    } catch {
      return new Set();
    }
  });
  const previousChangeSignaturesRef = useRef<Map<number, string>>(new Map());

  // ── Collapsed sections ──────────────────────────────
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const firstEntryDefault = new Set(FIRST_ENTRY_COLLAPSED_SECTIONS);
    if (typeof window === 'undefined') return firstEntryDefault;
    try {
      const saved = localStorage.getItem(REVIEW_COLLAPSED_SECTIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed.filter((item): item is string => typeof item === 'string'));
        }
      }
    } catch {
      // ignore localStorage errors
    }
    return firstEntryDefault;
  });

  // ── AI auto-monitor (state + effects extracted to hook) ──
  const {
    riskMap,
    autoAiEnabled,
    setAutoAiEnabled,
    autoAiPauseUntil,
    autoAiStatusSummary,
  } = useAutoAiMonitor(dashboard);

  // ── Auto-refresh ────────────────────────────────────
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboard = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoadingDashboard(true);
      setDashboardError(null);
    }
    try {
      const res = await httpGet<DashboardResponse>('/api/gerrit/dashboard');

      const currentSignatureMap = new Map<number, string>();
      for (const section of res.sections || []) {
        for (const change of section.changes || []) {
          currentSignatureMap.set(change._number, buildChangeSignature(change));
        }
      }

      const previousSignatureMap = previousChangeSignaturesRef.current;
      if (previousSignatureMap.size > 0) {
        setUnreadChangeIds((prev) => {
          const next = new Set(prev);
          currentSignatureMap.forEach((signature, changeNumber) => {
            const previousSignature = previousSignatureMap.get(changeNumber);
            if (!previousSignature || previousSignature !== signature) {
              next.add(changeNumber);
            }
          });
          return next;
        });
      }
      previousChangeSignaturesRef.current = currentSignatureMap;

      setDashboard(res);
      setLastRefresh(new Date());
    } catch (err: any) {
      setDashboardError(err.message || 'Failed to fetch dashboard');
    } finally {
      if (!silent) {
        setLoadingDashboard(false);
      }
    }
  }, []);

  // Load config + initial dashboard + auto-refresh every 60s
  useEffect(() => {
    httpGet<{ gerritUrl: string }>('/api/gerrit/config')
      .then((cfg) => { if (cfg.gerritUrl) setGerritUrl(cfg.gerritUrl); })
      .catch(() => {});
    fetchDashboard();
    refreshIntervalRef.current = setInterval(() => {
      fetchDashboard({ silent: true });
    }, 60_000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [fetchDashboard]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(REVIEW_COLLAPSED_SECTIONS_KEY, JSON.stringify(Array.from(collapsedSections)));
    } catch {
      // ignore localStorage errors
    }
  }, [collapsedSections]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(REVIEW_UNREAD_CHANGE_IDS_KEY, JSON.stringify(Array.from(unreadChangeIds)));
    } catch {
      // ignore localStorage errors
    }
  }, [unreadChangeIds]);

  useEffect(() => {
    if (!router.isReady) return;
    const rawChange = Array.isArray(router.query.change) ? router.query.change[0] : router.query.change;
    const parsed = rawChange ? Number(rawChange) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      setSelectedChangeNumber(parsed);
      setView('detail');
    }
  }, [router.isReady, router.query.change]);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const normalizedQuery = normalizeQueryInput(searchQuery);
    setSearchLoading(true);
    setHasSearched(true);
    try {
      const res = await httpGet<{ changes: GerritChange[] }>('/api/gerrit/changes', { q: normalizedQuery });
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
    setUnreadChangeIds((prev) => {
      if (!prev.has(change._number)) return prev;
      const next = new Set(prev);
      next.delete(change._number);
      return next;
    });
    setSelectedChangeNumber(change._number);
    setView('detail');
    router.replace({ pathname: '/review', query: { change: String(change._number) } }, undefined, { shallow: true }).catch(() => {});
  }, [router]);

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

  const expandSection = useCallback((...titles: string[]) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      titles.forEach((title) => {
        if (!title) return;
        next.delete(title);
      });
      return next;
    });
  }, []);

  // Compute stats
  const stats = dashboard ? {
    yourTurn: (dashboard.sections.find((s) => normalizeSectionTitle(s.title) === 'Your Turn'))?.changes.length || 0,
    incoming: (dashboard.sections.find((s) => s.title === 'Incoming Reviews') || dashboard.sections.find((s) => s.title === '待我评审'))?.changes.length || 0,
    outgoing: (dashboard.sections.find((s) => s.title === 'Outgoing Reviews') || dashboard.sections.find((s) => s.title === '我发起的'))?.changes.length || 0,
    cced: (dashboard.sections.find((s) => s.title === 'CC\'ed On') || dashboard.sections.find((s) => s.title === '抄送我的'))?.changes.length || 0,
    closed: (dashboard.sections.find((s) => normalizeSectionTitle(s.title) === 'Recently Closed'))?.changes.length || 0,
  } : null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Change detail view
  if (view === 'detail' && selectedChangeNumber) {
    return (
      <div className="h-full overflow-auto bg-background">
        <div className="max-w-[1600px] mx-auto p-6">
          <ChangeDetail
            key={selectedChangeNumber}
            changeNumber={selectedChangeNumber}
            gerritUrl={gerritUrl}
            onBack={() => {
              setView(hasSearched && searchResults.length > 0 ? 'search' : 'dashboard');
              setSelectedChangeNumber(null);
              router.replace('/review', undefined, { shallow: true }).catch(() => {});
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background/50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* ── Header ────────────────────────────────────────────── */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <GitPullRequest className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Code Review</h1>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    Gerrit Dashboard
                    {dashboard?.account && (
                      <>
                        <span>•</span>
                        <span>{getAccountName(dashboard.account)}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative w-full md:w-64 lg:w-80">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    data-review-search
                    type="text"
                    placeholder="Search (#ID / owner:me / query)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-9 h-9 text-sm bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSearch}
                    disabled={searchLoading || !searchQuery.trim()}
                    className="h-9 w-9 text-muted-foreground"
                    title="Search"
                  >
                    {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      void fetchDashboard();
                    }}
                    disabled={loadingDashboard}
                    className="h-9 w-9 text-muted-foreground"
                    title="Refresh (r)"
                  >
                    <RefreshCw className={cn('h-4 w-4', loadingDashboard && 'animate-spin')} />
                  </Button>

                  <div className="h-4 w-px bg-border mx-1" />

                  <Button
                    variant={autoAiEnabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAutoAiEnabled((prev) => !prev)}
                    className="h-9 gap-2 text-xs"
                    title="Toggle AI Auto-Monitor"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Auto AI {autoAiEnabled ? 'On' : 'Off'}</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs text-muted-foreground hidden lg:flex"
                    onClick={() => router.push('/review-auto-ai')}
                  >
                    Monitor Status
                  </Button>

                  <a href={`${gerritUrl}/dashboard/self`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" title="Open Gerrit">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            </div>
            
            {/* Auto AI Status Bar (if active) */}
            {autoAiEnabled && (
               <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                       <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                       Monitoring active
                    </span>
                    <span>Pending: {autoAiStatusSummary.pending}</span>
                    <span>Running: {autoAiStatusSummary.running}</span>
                    <span>Done: {autoAiStatusSummary.done}</span>
                    {autoAiStatusSummary.error > 0 && <span className="text-red-500">Errors: {autoAiStatusSummary.error}</span>}
                  </div>
                  {autoAiPauseUntil && autoAiPauseUntil > Date.now() && (
                    <span className="text-amber-600 font-medium">
                      Rate limit paused until {new Date(autoAiPauseUntil).toLocaleTimeString()}
                    </span>
                  )}
               </div>
            )}
          </CardContent>
        </Card>

        {/* ── Search results view ──────────────────────────────── */}
        {view === 'search' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setView('dashboard')} className="-ml-2">← Back to Dashboard</Button>
                <span className="text-sm text-muted-foreground">
                  Results for &ldquo;{searchQuery}&rdquo; • {searchResults.length} found
                </span>
              </div>
            </div>
            {searchLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary/50" />
                <p className="text-sm">Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid gap-3">
                {searchResults.map((change) => (
                  <ChangeCard key={change._number} change={change} onClick={() => openChange(change)} gerritUrl={gerritUrl} unread={unreadChangeIds.has(change._number)} aiRiskLevel={riskMap[change._number]?.riskLevel} aiRiskReason={riskMap[change._number]?.briefReason} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground bg-card rounded-lg border border-dashed">
                <p className="text-sm">No changes found matching your query.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Dashboard view ───────────────────────────────────── */}
        {view === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Stats Overview */}
            {stats && !loadingDashboard && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Your Turn', key: 'Your Turn', value: stats.yourTurn, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-500/10' },
                  { label: 'Outgoing Reviews', key: 'Outgoing Reviews', value: stats.outgoing, icon: Send, color: 'text-blue-600', bg: 'bg-blue-500/10' },
                  { label: 'Incoming Reviews', key: 'Incoming Reviews', value: stats.incoming, icon: Inbox, color: 'text-amber-600', bg: 'bg-amber-500/10' },
                  { label: 'CC\'ed On', key: 'CC\'ed On', value: stats.cced, icon: Mail, color: 'text-purple-600', bg: 'bg-purple-500/10' },
                  { label: 'Recently Closed', key: 'Recently Closed', value: stats.closed, icon: GitMerge, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                ].map((stat) => {
                  const Icon = stat.icon;
                  // Handle legacy keys for collapse
                  const collapseKey = stat.key === 'Your Turn' ? '轮到我处理' :
                                      stat.key === 'Incoming Reviews' ? '待我评审' :
                                      stat.key === 'Outgoing Reviews' ? '我发起的' :
                                      stat.key === 'CC\'ed On' ? '抄送我的' :
                                      stat.key === 'Recently Closed' ? '最近关闭' : stat.key;
                  
                  // Use english key primarily
                  const effectiveKey = stat.key;
                  
                  const isCollapsed = collapsedSections.has(effectiveKey) || collapsedSections.has(collapseKey);

                  return (
                    <Card 
                      key={stat.label} 
                      className="cursor-pointer hover:shadow-md transition-all duration-200 border-none shadow-sm bg-card group"
                      onClick={() => {
                        // From top overview, always expand target section before jumping.
                        expandSection(effectiveKey, collapseKey);

                        setTimeout(() => {
                           const el = document.getElementById(`section-${effectiveKey}`) || document.getElementById(`section-${collapseKey}`);
                           el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 50);
                      }}
                    >
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{stat.label}</p>
                          <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                        </div>
                        <div className={cn(
                           "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
                           isCollapsed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                        )}>
                           <Icon className="h-6 w-6" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Last refresh info */}
            {lastRefresh && (
              <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground/60 px-1">
                <Clock className="h-3 w-3" />
                <span>Updated {lastRefresh.toLocaleTimeString()}</span>
                <span>•</span>
                <span>Auto-refresh every 60s</span>
                <span className="hidden sm:inline-block ml-2">
                  <Keyboard className="h-3 w-3 inline mr-1" />
                  <span className="bg-muted/50 px-1 rounded">/</span> search
                  <span className="bg-muted/50 px-1 rounded ml-1">r</span> refresh
                </span>
              </div>
            )}

            {/* Loading state */}
            {loadingDashboard && !dashboard && (
              <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary/40" />
                <p className="text-sm">Loading Dashboard...</p>
              </div>
            )}

            {/* Error state */}
            {dashboardError && !dashboard && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                     <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                     <h3 className="text-lg font-semibold text-red-900">Dashboard Error</h3>
                     <p className="text-sm text-red-700 mt-1">{dashboardError}</p>
                  </div>
                  <Button variant="outline" onClick={() => { void fetchDashboard(); }} className="bg-white hover:bg-red-50 text-red-700 border-red-200">
                    Retry Connection
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Dashboard sections */}
            <div className="space-y-6">
              {dashboard && [...dashboard.sections]
                .sort((a, b) => {
                  const ai = SECTION_ORDER.indexOf(normalizeSectionTitle(a.title));
                  const bi = SECTION_ORDER.indexOf(normalizeSectionTitle(b.title));
                  const av = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
                  const bv = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
                  return av - bv;
                })
                .map((section) => {
                const normalizedTitle = normalizeSectionTitle(section.title);
                const Icon = SECTION_ICONS[normalizedTitle] || SECTION_ICONS[section.title] || Inbox;
                const isCollapsed = collapsedSections.has(normalizedTitle) || collapsedSections.has(section.title);
                const isEmpty = section.changes.length === 0;
                
                return (
                  <div key={section.title} id={`section-${normalizedTitle}`} className="space-y-3">
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(normalizedTitle)}
                      className="w-full flex items-center justify-between group rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                           "h-8 w-8 rounded-lg flex items-center justify-center transition-colors shadow-sm",
                           isCollapsed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                        )}>
                           <Icon className="h-4 w-4" />
                        </div>
                        <h2 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {normalizedTitle}
                        </h2>
                        <Badge variant="secondary" className="ml-2 bg-muted text-muted-foreground font-mono">
                          {section.changes.length}
                        </Badge>
                      </div>
                      <div className="h-px flex-1 bg-border mx-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                      {isCollapsed ? (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    {/* Section Content */}
                    {!isCollapsed && (
                      <div className="animate-in slide-in-from-top-2 duration-200 rounded-xl border border-dashed border-border/60 bg-background/40 p-3">
                        {isEmpty ? (
                          <div className="p-8 text-center text-sm text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border/60">
                            No changes in this section
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {section.changes.map((change) => (
                              <ChangeCard
                                key={change._number}
                                change={change}
                                onClick={() => openChange(change)}
                                gerritUrl={gerritUrl}
                                showOwner={normalizedTitle !== 'Outgoing Reviews'}
                                unread={unreadChangeIds.has(change._number)}
                                aiRiskLevel={riskMap[change._number]?.riskLevel}
                                aiRiskReason={riskMap[change._number]?.briefReason}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
