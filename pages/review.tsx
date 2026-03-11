import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { httpGet } from '@/lib/httpClient';
import type { DashboardResponse, GerritChange } from '@/lib/gerrit/types';
import { normalizeQueryInput } from '@/lib/gerrit/helpers';
import { useAutoAiMonitor } from '@/hooks/useAutoAiMonitor';
import { ChangeCard } from '@/components/review/ChangeCard';
import { ChangeDetail } from '@/components/review/ChangeDetail';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  GlassIconButton,
  GlassPage,
  GlassPanel,
  GlassSection,
  GlassToolbar,
  glassInputClass,
  glassPanelStrongClass,
} from '@/components/ui/glass';
import {
  GitPullRequest,
  Search,
  RefreshCw,
  Loader2,
  Inbox,
  Send,
  AlertCircle,
  Sparkles,
  Archive,
} from 'lucide-react';

const DEFAULT_GERRIT_URL = 'https://review.tp-link.net/gerrit';
const REVIEW_UNREAD_CHANGE_IDS_KEY = 'review-unread-change-ids-v1';
const REVIEW_DASHBOARD_SCROLL_TOP_KEY = 'review-dashboard-scroll-top-v1';
const REVIEW_ARCHIVED_CHANGES_KEY = 'review-archived-changes-v1';
const REVIEW_AI_REVIEWED_DONE_KEY = 'review-ai-reviewed-done-v1';

const SECTION_ICONS: Record<string, typeof Inbox> = {
  'Your Turn': AlertCircle,
  'Incoming Reviews': Inbox,
  'Outgoing Reviews': Send,
  // Fallbacks for legacy Chinese titles if API not updated immediately
  '轮到我处理': AlertCircle,
  '待我评审': Inbox,
  '我发起的': Send,
};

// Map legacy Chinese titles to English for display
const SECTION_TITLES: Record<string, string> = {
  '轮到我处理': 'Your Turn',
  '待我评审': 'Incoming Reviews',
  '我发起的': 'Outgoing Reviews',
};

const PRIMARY_SECTION_ORDER = ['Your Turn', 'Incoming Reviews', 'Outgoing Reviews'];

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

function loadArchivedChanges(): Record<number, GerritChange> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(REVIEW_ARCHIVED_CHANGES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const entries = Object.entries(parsed as Record<string, GerritChange>)
      .filter(([key, value]) => Number.isFinite(Number(key)) && !!value)
      .map(([key, value]) => [Number(key), value] as const);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function loadAiReviewedDoneMap(): Record<number, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(REVIEW_AI_REVIEWED_DONE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const entries = Object.entries(parsed as Record<string, string>)
      .filter(([key, value]) => Number.isFinite(Number(key)) && typeof value === 'string')
      .map(([key, value]) => [Number(key), value] as const);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

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

  // ── Search ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GerritChange[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivedChanges, setArchivedChanges] = useState<Record<number, GerritChange>>(() => loadArchivedChanges());
  const [aiReviewedDoneMap, setAiReviewedDoneMap] = useState<Record<number, string>>(() => loadAiReviewedDoneMap());
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dashboardScrollTopRef = useRef(0);

  // ── AI auto-monitor (state + effects extracted to hook) ──
  const {
    riskMap,
    autoAiEnabled,
    autoAiJobs,
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
      localStorage.setItem(REVIEW_UNREAD_CHANGE_IDS_KEY, JSON.stringify(Array.from(unreadChangeIds)));
    } catch {
      // ignore localStorage errors
    }
  }, [unreadChangeIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(REVIEW_ARCHIVED_CHANGES_KEY, JSON.stringify(archivedChanges));
    } catch {
      // ignore localStorage errors
    }
  }, [archivedChanges]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(REVIEW_AI_REVIEWED_DONE_KEY, JSON.stringify(aiReviewedDoneMap));
    } catch {
      // ignore localStorage errors
    }
  }, [aiReviewedDoneMap]);

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
    const nextScrollTop = scrollContainerRef.current?.scrollTop || 0;
    dashboardScrollTopRef.current = nextScrollTop;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(REVIEW_DASHBOARD_SCROLL_TOP_KEY, String(nextScrollTop));
      } catch {
        // ignore sessionStorage failures
      }
    }
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

  const archiveChange = useCallback((change: GerritChange) => {
    setArchivedChanges((prev) => {
      if (prev[change._number]) return prev;
      return { ...prev, [change._number]: change };
    });
    setUnreadChangeIds((prev) => {
      if (!prev.has(change._number)) return prev;
      const next = new Set(prev);
      next.delete(change._number);
      return next;
    });
    toast.success(`已归档 Change #${change._number}`);
  }, []);

  const restoreArchivedChange = useCallback((change: GerritChange) => {
    setArchivedChanges((prev) => {
      if (!prev[change._number]) return prev;
      const next = { ...prev };
      delete next[change._number];
      return next;
    });
    toast.success(`已从归档取出 Change #${change._number}`);
  }, []);

  useEffect(() => {
    if (view !== 'dashboard') return;

    let scrollTop = dashboardScrollTopRef.current;
    if (!scrollTop && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(REVIEW_DASHBOARD_SCROLL_TOP_KEY);
        const parsed = raw ? Number(raw) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) {
          scrollTop = parsed;
          dashboardScrollTopRef.current = parsed;
        }
      } catch {
        // ignore sessionStorage failures
      }
    }

    if (!scrollTop) return;

    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: scrollTop, behavior: 'auto' });
    });
  }, [view, dashboard]);

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

  const focusedSections = dashboard
    ? [...dashboard.sections]
        .map((section) => ({ ...section, title: normalizeSectionTitle(section.title) }))
        .map((section) => ({
          ...section,
          changes: section.changes.filter((change) => !archivedChanges[change._number]),
        }))
        .filter((section) => PRIMARY_SECTION_ORDER.includes(section.title))
        .sort((a, b) => PRIMARY_SECTION_ORDER.indexOf(a.title) - PRIMARY_SECTION_ORDER.indexOf(b.title))
    : [];

  const primaryQueue = focusedSections.filter((section) => section.title === 'Your Turn' || section.title === 'Incoming Reviews');
  const secondaryQueue = focusedSections.filter((section) => section.title === 'Outgoing Reviews');
  const archivedList = Object.values(archivedChanges).sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
  const latestDoneByChange = Object.values(autoAiJobs).reduce<Record<number, string>>((acc, job) => {
    if (job.status !== 'done') return acc;
    const current = acc[job.changeNumber];
    const nextUpdated = String(job.updatedAt || job.finishedAt || '');
    if (!current || nextUpdated > current) {
      acc[job.changeNumber] = nextUpdated;
    }
    return acc;
  }, {});
  const unreadAiDoneCount = Object.entries(latestDoneByChange).reduce((count, [changeNumberRaw, latestDoneAt]) => {
    const changeNumber = Number(changeNumberRaw);
    const reviewedAt = aiReviewedDoneMap[changeNumber] || '';
    return latestDoneAt > reviewedAt ? count + 1 : count;
  }, 0);

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Change detail view
  if (view === 'detail' && selectedChangeNumber) {
    return (
      <div ref={scrollContainerRef} className="h-full overflow-auto bg-background">
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
    <GlassPage showOrbs={false}>
      <div ref={scrollContainerRef} className="h-full overflow-auto">
        <div className="relative z-10 max-w-5xl mx-auto p-5 space-y-5">

          {/* ── Header ────────────────────────────────────────────── */}
          <GlassPanel className={cn(glassPanelStrongClass, 'rounded-3xl p-4 md:p-5')}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl border border-white/55 bg-white/52 shadow-[0_12px_28px_rgba(37,99,235,0.14)] backdrop-blur-lg flex items-center justify-center">
                    <GitPullRequest className="h-4.5 w-4.5 text-sky-700" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold tracking-tight text-slate-900">Review Inbox</h1>
                  </div>
                </div>

                <GlassToolbar className="flex items-center gap-3">
                  <div className="relative w-full md:w-72 lg:w-96">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      data-review-search
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className={cn('pl-9 h-9 text-sm shadow-none focus:border-sky-300', glassInputClass)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <GlassIconButton
                      onClick={handleSearch}
                      disabled={searchLoading || !searchQuery.trim()}
                      title="Search"
                      tone="primary"
                    >
                      {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </GlassIconButton>

                    <GlassIconButton
                      onClick={() => {
                        void fetchDashboard();
                      }}
                      disabled={loadingDashboard}
                      title="Refresh"
                    >
                      <RefreshCw className={cn('h-4 w-4', loadingDashboard && 'animate-spin')} />
                    </GlassIconButton>

                    <GlassIconButton
                      onClick={() => {
                        setAiReviewedDoneMap((prev) => {
                          if (unreadAiDoneCount <= 0) return prev;
                          const next = { ...prev };
                          for (const [changeNumberRaw, latestDoneAt] of Object.entries(latestDoneByChange)) {
                            const changeNumber = Number(changeNumberRaw);
                            if (!next[changeNumber] || latestDoneAt > next[changeNumber]) {
                              next[changeNumber] = latestDoneAt;
                            }
                          }
                          return next;
                        });
                        void router.push('/review-auto-ai');
                      }}
                      className={cn('relative', autoAiEnabled ? 'text-sky-700' : 'text-slate-600')}
                      title="AI Assistant"
                      tone="primary"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {unreadAiDoneCount > 0 && (
                        <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-sky-500 text-white text-[9px] leading-4 text-center">
                          {unreadAiDoneCount > 99 ? '99+' : unreadAiDoneCount}
                        </span>
                      )}
                    </GlassIconButton>

                    <GlassIconButton
                      onClick={() => setArchiveDialogOpen(true)}
                      className="relative"
                      title="Archived Changes"
                      tone="warning"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      {archivedList.length > 0 && (
                        <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] leading-4 text-center">
                          {archivedList.length > 99 ? '99+' : archivedList.length}
                        </span>
                      )}
                    </GlassIconButton>
                  </div>
                </GlassToolbar>
              </div>
            </div>
          </GlassPanel>

        <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <DialogContent className={cn("max-w-3xl rounded-3xl border border-white/70 bg-[#f8fbff]/92 p-5 shadow-[0_28px_66px_rgba(15,23,42,0.2)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78")}>
            <DialogHeader className="pb-1">
              <DialogTitle className="text-slate-900">Archived Changes ({archivedList.length})</DialogTitle>
            </DialogHeader>
            {archivedList.length === 0 ? (
              <GlassSection className="glass-interactive border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                No archived changes.
              </GlassSection>
            ) : (
              <div className="max-h-[60vh] overflow-auto rounded-2xl border border-white/70 bg-white/48 p-2.5 backdrop-blur-xl supports-[backdrop-filter]:bg-white/34">
                <div className="space-y-3 pr-1">
                {archivedList.map((change) => (
                  <ChangeCard
                    key={`archived-${change._number}`}
                    change={change}
                    onClick={() => openChange(change)}
                    gerritUrl={gerritUrl}
                    unread={false}
                    aiRiskLevel={riskMap[change._number]?.riskLevel}
                    aiRiskReason={riskMap[change._number]?.briefReason}
                    onArchiveToggle={restoreArchivedChange}
                    archiveMode="restore"
                  />
                ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
                  <ChangeCard
                    key={change._number}
                    change={change}
                    onClick={() => openChange(change)}
                    gerritUrl={gerritUrl}
                    unread={unreadChangeIds.has(change._number)}
                    aiRiskLevel={riskMap[change._number]?.riskLevel}
                    aiRiskReason={riskMap[change._number]?.briefReason}
                    onArchiveToggle={archiveChange}
                  />
                ))}
              </div>
            ) : (
              <GlassSection className="text-center py-20 text-muted-foreground border-dashed">
                <p className="text-sm">No changes found matching your query.</p>
              </GlassSection>
            )}
          </div>
        )}

        {/* ── Dashboard view ───────────────────────────────────── */}
        {view === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
            <div className="space-y-7">
              <section className="space-y-4">
                <div className="space-y-4">
                  {primaryQueue.map((section) => {
                    const Icon = SECTION_ICONS[section.title] || Inbox;
                    return (
                      <GlassSection key={section.title} id={`section-${section.title}`} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-2xl bg-primary/8 border border-primary/10 text-primary flex items-center justify-center">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold text-foreground">{section.title}</h3>
                            <p className="text-xs text-muted-foreground">{section.changes.length} changes</p>
                          </div>
                        </div>

                        {section.changes.length === 0 ? (
                          <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
                            No changes in this queue.
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {section.changes.map((change) => (
                              <ChangeCard
                                key={change._number}
                                change={change}
                                onClick={() => openChange(change)}
                                gerritUrl={gerritUrl}
                                showOwner={section.title !== 'Outgoing Reviews'}
                                unread={unreadChangeIds.has(change._number)}
                                aiRiskLevel={riskMap[change._number]?.riskLevel}
                                aiRiskReason={riskMap[change._number]?.briefReason}
                                onArchiveToggle={archiveChange}
                              />
                            ))}
                          </div>
                        )}
                      </GlassSection>
                    );
                  })}
                </div>
              </section>

              {secondaryQueue.length > 0 && (
                <GlassSection className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-2xl bg-primary/8 border border-primary/10 text-primary flex items-center justify-center">
                      <Send className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold text-foreground">Authored by Me</h2>
                      <p className="text-xs text-muted-foreground">
                        {secondaryQueue.reduce((sum, section) => sum + section.changes.length, 0)} changes
                      </p>
                    </div>
                  </div>

                  {secondaryQueue.map((section) => (
                    <div key={section.title} className="grid gap-3">
                      {section.changes.length === 0 ? (
                        <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
                          No open outgoing reviews.
                        </div>
                      ) : (
                        section.changes.map((change) => (
                          <ChangeCard
                            key={change._number}
                            change={change}
                            onClick={() => openChange(change)}
                            gerritUrl={gerritUrl}
                            showOwner={false}
                            unread={unreadChangeIds.has(change._number)}
                            aiRiskLevel={riskMap[change._number]?.riskLevel}
                            aiRiskReason={riskMap[change._number]?.briefReason}
                            onArchiveToggle={archiveChange}
                          />
                        ))
                      )}
                    </div>
                  ))}
                </GlassSection>
              )}

              {dashboard && focusedSections.length === 0 && !loadingDashboard && (
                <GlassSection className="border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  No review items found in the focused queues.
                </GlassSection>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </GlassPage>
  );
}
