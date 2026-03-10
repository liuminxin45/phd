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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  GitPullRequest,
  Search,
  RefreshCw,
  Loader2,
  Inbox,
  Send,
  AlertCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';

const DEFAULT_GERRIT_URL = 'https://review.tp-link.net/gerrit';
const REVIEW_UNREAD_CHANGE_IDS_KEY = 'review-unread-change-ids-v1';

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

export default function ReviewPage() {
  const router = useRouter();
  // ── View navigation ─────────────────────────────────
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedChangeNumber, setSelectedChangeNumber] = useState<number | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

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

  const focusedSections = dashboard
    ? [...dashboard.sections]
        .map((section) => ({ ...section, title: normalizeSectionTitle(section.title) }))
        .filter((section) => PRIMARY_SECTION_ORDER.includes(section.title))
        .sort((a, b) => PRIMARY_SECTION_ORDER.indexOf(a.title) - PRIMARY_SECTION_ORDER.indexOf(b.title))
    : [];

  const primaryQueue = focusedSections.filter((section) => section.title === 'Your Turn' || section.title === 'Incoming Reviews');
  const secondaryQueue = focusedSections.filter((section) => section.title === 'Outgoing Reviews');

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
    <div className="h-full overflow-auto bg-[hsl(var(--background))]">
      <div className="max-w-5xl mx-auto p-5 space-y-5">

        {/* ── Header ────────────────────────────────────────────── */}
        <Card className="border border-border/60 shadow-none bg-card/90">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-primary/8 border border-primary/10 flex items-center justify-center">
                    <GitPullRequest className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">Review Inbox</h1>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-full md:w-72 lg:w-96">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-review-search
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="pl-9 h-9 text-sm bg-muted/18 border-border/50 shadow-none focus:bg-background focus:border-border"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSearch}
                      disabled={searchLoading || !searchQuery.trim()}
                      className="h-9 w-9 text-muted-foreground/70 hover:text-foreground"
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
                      className="h-9 w-9 text-muted-foreground/70 hover:text-foreground"
                      title="Refresh"
                    >
                      <RefreshCw className={cn('h-4 w-4', loadingDashboard && 'animate-spin')} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAiDialogOpen(true)}
                      className={cn(
                        'h-9 w-9 hover:text-foreground',
                        autoAiEnabled ? 'text-primary' : 'text-muted-foreground/70'
                      )}
                      title="AI Assistant"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
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
                      <div key={section.title} id={`section-${section.title}`} className="space-y-3">
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
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {secondaryQueue.length > 0 && (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Authored by Me</h2>
                    <p className="text-sm text-muted-foreground">Kept for follow-up, but visually secondary.</p>
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
                          />
                        ))
                      )}
                    </div>
                  ))}
                </section>
              )}

              {dashboard && focusedSections.length === 0 && !loadingDashboard && (
                <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                  No review items found in the focused queues.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>AI Assistant</DialogTitle>
            <DialogDescription>
              AI features are grouped here to keep the review inbox focused on the queue itself.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">Auto AI Monitor</div>
                  <div className="text-xs text-muted-foreground">
                    Automatically tracks risk evaluation progress in the background.
                  </div>
                </div>
                <Button
                  variant={autoAiEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAutoAiEnabled((prev) => !prev)}
                  className="shrink-0"
                >
                  {autoAiEnabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Pending</div>
                  <div className="text-lg font-semibold text-foreground">{autoAiStatusSummary.pending}</div>
                </div>
                <div className="rounded-lg bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Running</div>
                  <div className="text-lg font-semibold text-foreground">{autoAiStatusSummary.running}</div>
                </div>
                <div className="rounded-lg bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Done</div>
                  <div className="text-lg font-semibold text-foreground">{autoAiStatusSummary.done}</div>
                </div>
                <div className="rounded-lg bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Errors</div>
                  <div className={cn('text-lg font-semibold', autoAiStatusSummary.error > 0 ? 'text-red-600' : 'text-foreground')}>
                    {autoAiStatusSummary.error}
                  </div>
                </div>
              </div>

              {autoAiPauseUntil && autoAiPauseUntil > Date.now() && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Rate limit paused until {new Date(autoAiPauseUntil).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => router.push('/review-auto-ai')}>
              Open AI Monitor
            </Button>
            <Button onClick={() => setAiDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
