import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { httpGet } from '@/lib/httpClient';
import {
  Clock,
  ChevronDown,
  ArrowUpDown,
  BookOpen,
  Star,
  Plus,
  Loader2,
  ThumbsUp,
} from 'lucide-react';

import type { ApiBlogPost, BlogPost, PostsResponse } from '@/lib/blog/types';
import {
  SORT_OPTIONS,
  apiPostToBlogPost,
  computeTrendThresholds,
} from '@/lib/blog/helpers';

import { LandingView } from '@/components/blog/LandingView';
import { ReportView } from '@/components/blog/ReportView';
import { PostDetailView } from '@/components/blog/PostDetailView';
import { CreateBlogView, CreateReportView } from '@/components/blog/BlogEditor';
import { FeaturedCard, PostListItem } from '@/components/blog/PostCards';
import { Button } from '@/components/ui/button';
import { AutoLikeDialog } from '@/components/blog/AutoLikeDialog';
import { cn } from '@/lib/utils';
import { useAutoLike } from '@/hooks/useAutoLike';
import { GlassIconButton, GlassPage, GlassPanel, GlassSection, glassPanelStrongClass } from '@/components/ui/glass';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

const BLOG_SORT_TRIGGER_CLASS = 'h-8 gap-2 rounded-full border border-white/55 bg-white/68 px-3 text-xs shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52 hover:border-sky-200/80 hover:bg-white/78';
type BlogMainView = 'landing' | 'tech' | 'report';
type PostSourceType = 'tech' | 'report';

function isBlogMainView(view: string): view is BlogMainView {
  return view === 'landing' || view === 'tech' || view === 'report';
}

const BLOG_SCROLL_STORAGE_KEY = 'blogs.scroll.positions.v1';

export default function BlogsPage() {
  const [currentView, setCurrentView] = useState<'landing' | 'tech' | 'report' | 'create' | 'create-report' | 'post-detail'>('landing');
  const [previousView, setPreviousView] = useState<BlogMainView>('tech');
  const [selectedPost, setSelectedPost] = useState<ApiBlogPost | null>(null);
  const [selectedPostSource, setSelectedPostSource] = useState<PostSourceType>('tech');
  const [sortOrder, setSortOrder] = useState('recommended');
  const [latestTechPost, setLatestTechPost] = useState<ApiBlogPost | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef<Record<BlogMainView, number>>({ landing: 0, tech: 0, report: 0 });
  const [pendingRestoreView, setPendingRestoreView] = useState<BlogMainView | null>(null);

  // ── API data ──────────────────────────────────────────────
  const [techPosts, setTechPosts] = useState<ApiBlogPost[]>([]);
  const [reportPosts, setReportPosts] = useState<ApiBlogPost[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<ApiBlogPost[]>([]);
  const [loadingTech, setLoadingTech] = useState(true);
  const [loadingReport, setLoadingReport] = useState(true);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingMoreTech, setLoadingMoreTech] = useState(false);
  const [loadingMoreReport, setLoadingMoreReport] = useState(false);
  const [techCursor, setTechCursor] = useState<string | null>(null);
  const [reportCursor, setReportCursor] = useState<string | null>(null);

  const fetchPosts = useCallback(async (params: Record<string, any>): Promise<PostsResponse> => {
    try {
      const res = await httpGet<PostsResponse>('/api/blogs/posts', params);
      return { data: res.data || [], cursor: res.cursor || { after: null } };
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      return { data: [], cursor: { after: null } };
    }
  }, []);

  // Initial load: tech (sorted), report, and featured
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingTech(true);
      setLoadingReport(true);
      setLoadingFeatured(true);

      const [techRes, reportRes, featuredRes] = await Promise.all([
        fetchPosts({ type: 'tech', sort: sortOrder }),
        fetchPosts({ type: 'report' }),
        fetchPosts({ type: 'tech', featured: 'true', limit: 3 }),
      ]);
      const latestTechRes = await fetchPosts({ type: 'tech', sort: 'newest', limit: 1 });

      if (!cancelled) {
        setTechPosts(techRes.data);
        setTechCursor(techRes.cursor.after);
        setLoadingTech(false);

        setReportPosts(reportRes.data);
        setReportCursor(reportRes.cursor.after);
        setLoadingReport(false);

        setFeaturedPosts(featuredRes.data);
        setLoadingFeatured(false);
        setLatestTechPost(latestTechRes.data[0] || null);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPosts]);

  // Refetch tech posts when sort order changes (after initial load)
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  useEffect(() => {
    if (!initialLoadDone) { setInitialLoadDone(true); return; }
    let cancelled = false;
    (async () => {
      setLoadingTech(true);
      const res = await fetchPosts({ type: 'tech', sort: sortOrder });
      if (!cancelled) {
        setTechPosts(res.data);
        setTechCursor(res.cursor.after);
        setLoadingTech(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder]);

  // Load more handlers
  const loadMoreTech = useCallback(async () => {
    if (!techCursor || loadingMoreTech) return;
    setLoadingMoreTech(true);
    const res = await fetchPosts({ type: 'tech', sort: sortOrder, after: techCursor });
    setTechPosts((prev) => [...prev, ...res.data]);
    setTechCursor(res.cursor.after);
    setLoadingMoreTech(false);
  }, [techCursor, loadingMoreTech, sortOrder, fetchPosts]);

  const loadMoreReport = useCallback(async () => {
    if (!reportCursor || loadingMoreReport) return;
    setLoadingMoreReport(true);
    const res = await fetchPosts({ type: 'report', after: reportCursor });
    setReportPosts((prev) => [...prev, ...res.data]);
    setReportCursor(res.cursor.after);
    setLoadingMoreReport(false);
  }, [reportCursor, loadingMoreReport, fetchPosts]);

  const refreshPostsAfterPublish = useCallback(async (type: 'tech' | 'report') => {
    if (type === 'tech') {
      setLoadingTech(true);
      setLoadingFeatured(true);
      try {
        const [techRes, featuredRes] = await Promise.all([
          fetchPosts({ type: 'tech', sort: sortOrder }),
          fetchPosts({ type: 'tech', featured: 'true', limit: 3 }),
        ]);
        const latestTechRes = await fetchPosts({ type: 'tech', sort: 'newest', limit: 1 });
        setTechPosts(techRes.data);
        setTechCursor(techRes.cursor.after);
        setFeaturedPosts(featuredRes.data);
        setLatestTechPost(latestTechRes.data[0] || null);
      } finally {
        setLoadingTech(false);
        setLoadingFeatured(false);
      }
      return;
    }

    setLoadingReport(true);
    try {
      const reportRes = await fetchPosts({ type: 'report' });
      setReportPosts(reportRes.data);
      setReportCursor(reportRes.cursor.after);
    } finally {
      setLoadingReport(false);
    }
  }, [fetchPosts, sortOrder]);

  // Derive BlogPost[] for the tech blog view
  const techBlogPosts: BlogPost[] = techPosts.map(apiPostToBlogPost);
  const featuredBlogPosts: BlogPost[] = featuredPosts.map((p) => ({ ...apiPostToBlogPost(p), featured: true }));
  const landingLatestTechPost = useMemo(() => {
    if (latestTechPost) return latestTechPost;
    if (techPosts.length === 0) return null;
    return [...techPosts].sort((a, b) => {
      const aTime = a.datePublished || a.dateCreated || 0;
      const bTime = b.datePublished || b.dateCreated || 0;
      return bTime - aTime;
    })[0] || null;
  }, [latestTechPost, techPosts]);

  // Dynamic trend thresholds
  const trendThresholds = useMemo(() => computeTrendThresholds(techBlogPosts), [techBlogPosts]);

  // Open post detail
  const restoreScrollForView = useCallback((view: BlogMainView) => {
    const top = scrollPositionsRef.current[view] ?? 0;
    const restore = () => {
      if (!scrollContainerRef.current) return;
      scrollContainerRef.current.scrollTo({ top, behavior: 'auto' });
    };
    requestAnimationFrame(restore);
    window.setTimeout(restore, 40);
    window.setTimeout(restore, 140);
    window.setTimeout(restore, 320);
    window.setTimeout(restore, 640);
  }, []);

  const saveScrollForView = useCallback((view: BlogMainView) => {
    if (!scrollContainerRef.current) return;
    scrollPositionsRef.current[view] = scrollContainerRef.current.scrollTop;
    try {
      sessionStorage.setItem(BLOG_SCROLL_STORAGE_KEY, JSON.stringify(scrollPositionsRef.current));
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BLOG_SCROLL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<BlogMainView, number>>;
      scrollPositionsRef.current = {
        landing: Number.isFinite(parsed.landing) ? Number(parsed.landing) : 0,
        tech: Number.isFinite(parsed.tech) ? Number(parsed.tech) : 0,
        report: Number.isFinite(parsed.report) ? Number(parsed.report) : 0,
      };
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;

    const onScroll = () => {
      if (isBlogMainView(currentView)) {
        scrollPositionsRef.current[currentView] = scroller.scrollTop;
        try {
          sessionStorage.setItem(BLOG_SCROLL_STORAGE_KEY, JSON.stringify(scrollPositionsRef.current));
        } catch {
          // ignore
        }
      }
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [currentView]);

  useEffect(() => {
    if (!pendingRestoreView) return;
    if (currentView !== pendingRestoreView) return;
    restoreScrollForView(pendingRestoreView);
    setPendingRestoreView(null);
  }, [currentView, pendingRestoreView, restoreScrollForView]);

  const openPost = useCallback((post: ApiBlogPost) => {
    const source: PostSourceType = currentView === 'report' ? 'report' : 'tech';
    const fromView: BlogMainView = source === 'report' ? 'report' : 'tech';
    saveScrollForView(fromView);
    setPreviousView(fromView);
    setSelectedPostSource(source);
    setSelectedPost(post);
    setCurrentView('post-detail');
  }, [currentView, saveScrollForView]);
  const openPostFromBlog = useCallback((blogPost: BlogPost) => {
    const apiPost = techPosts.find((p) => p.id === blogPost.id) || reportPosts.find((p) => p.id === blogPost.id) || featuredPosts.find((p) => p.id === blogPost.id);
    if (apiPost) {
      const source: PostSourceType = currentView === 'report' ? 'report' : 'tech';
      const fromView: BlogMainView = source === 'report' ? 'report' : 'tech';
      saveScrollForView(fromView);
      setPreviousView(fromView);
      setSelectedPostSource(source);
      setSelectedPost(apiPost);
      setCurrentView('post-detail');
    }
  }, [techPosts, reportPosts, featuredPosts, currentView, saveScrollForView]);

  const refreshTechPosts = useCallback(async () => {
    await refreshPostsAfterPublish('tech');
  }, [refreshPostsAfterPublish]);

  const {
    autoLikeEnabled,
    setAutoLikeEnabled,
    autoLikeIntervalMinutes,
    autoLikeRecords,
    autoLikeStats,
    showAutoLikeRecords,
    setShowAutoLikeRecords,
    autoLikeRunning,
    autoLikeDialogOpen,
    setAutoLikeDialogOpen,
    runAutoLike,
    clearAutoLikeRecords,
    onIntervalInput,
  } = useAutoLike({
    fetchPosts,
    refreshTechPosts,
  });

  return (
    <GlassPage showOrbs={false} className="min-h-full">
    <div ref={scrollContainerRef} data-blog-scroll className="h-full overflow-auto">
    <div className="mx-auto min-h-full max-w-6xl space-y-5 p-5">
      {/* ── 1. Header ──────────────────────────────────────────────────── */}
      <GlassPanel className={cn(glassPanelStrongClass, 'rounded-3xl p-4 md:p-5')}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/55 bg-white/52 shadow-[0_12px_28px_rgba(37,99,235,0.14)] backdrop-blur-lg">
                <BookOpen className="h-4.5 w-4.5 text-sky-700" />
              </div>
              <span
                className="text-lg font-semibold tracking-tight text-slate-900 cursor-pointer hover:text-slate-700 transition-colors"
                onClick={() => setCurrentView('landing')}
              >
                Phabricator Blog
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(currentView === 'tech' || currentView === 'create') && (
                <GlassIconButton
                  onClick={() => setAutoLikeDialogOpen(true)}
                  tone="primary"
                  tooltip="Random Like"
                  aria-label="Random Like"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </GlassIconButton>
              )}
              {(currentView === 'tech' || currentView === 'create') && (
                <GlassIconButton
                  onClick={() => setCurrentView(currentView === 'create' ? 'tech' : 'create')}
                  tone="primary"
                  tooltip={currentView === 'create' ? 'Back to Tech Blog' : 'Create New Blog'}
                  aria-label={currentView === 'create' ? 'Back to Tech Blog' : 'Create New Blog'}
                >
                  {currentView === 'create' ? (
                    <BookOpen className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </GlassIconButton>
              )}
              {currentView === 'report' && (
                <GlassIconButton
                  onClick={() => setCurrentView('create-report')}
                  tone="primary"
                  tooltip="New Report"
                  aria-label="New Report"
                >
                  <Plus className="h-3.5 w-3.5" />
                </GlassIconButton>
              )}
            </div>
          </div>
        </div>
      </GlassPanel>

      <AutoLikeDialog
        open={autoLikeDialogOpen}
        onOpenChange={setAutoLikeDialogOpen}
        autoLikeEnabled={autoLikeEnabled}
        onAutoLikeEnabledChange={setAutoLikeEnabled}
        autoLikeIntervalMinutes={autoLikeIntervalMinutes}
        onAutoLikeIntervalChange={onIntervalInput}
        autoLikeRunning={autoLikeRunning}
        onRunNow={runAutoLike}
        autoLikeStats={autoLikeStats}
        autoLikeRecords={autoLikeRecords}
        showAutoLikeRecords={showAutoLikeRecords}
        onToggleRecords={() => setShowAutoLikeRecords((v) => !v)}
        onClearRecords={clearAutoLikeRecords}
      />

      {/* ── View: Landing ────────────────────────────────────────────── */}
      {currentView === 'landing' && (
        <GlassSection>
          <LandingView
            onNavigate={(view) => setCurrentView(view)}
            techPosts={landingLatestTechPost ? [landingLatestTechPost] : []}
            reportPosts={reportPosts}
            loading={loadingTech || loadingReport}
          />
        </GlassSection>
      )}

      {/* ── View: Post Detail ──────────────────────────────────────────── */}
      {currentView === 'post-detail' && selectedPost && (
        <GlassSection>
          <PostDetailView
            post={selectedPost}
            canLike={selectedPostSource === 'tech'}
            onBack={() => {
              const viewToRestore = previousView;
              setSelectedPost(null);
              setCurrentView(viewToRestore);
              setPendingRestoreView(viewToRestore);
            }}
          />
        </GlassSection>
      )}

      {/* ── View: Report ─────────────────────────────────────────────── */}
      {currentView === 'report' && (
        <GlassSection>
          <ReportView posts={reportPosts} loading={loadingReport} onLoadMore={loadMoreReport} hasMore={!!reportCursor} loadingMore={loadingMoreReport} onPostClick={openPost} />
        </GlassSection>
      )}

      {/* ── View: Create Report ────────────────────────────────────────── */}
      {currentView === 'create-report' && (
        <GlassSection>
          <CreateReportView
            onBack={() => setCurrentView('report')}
            onPublished={() => refreshPostsAfterPublish('report')}
          />
        </GlassSection>
      )}

      {/* ── View: Create Blog ──────────────────────────────────────────── */}
      {currentView === 'create' && (
        <GlassSection>
          <CreateBlogView
            onBack={() => setCurrentView('tech')}
            onPublished={() => refreshPostsAfterPublish('tech')}
          />
        </GlassSection>
      )}

      {/* ── View: Tech Blog ──────────────────────────────────────────── */}
      {currentView === 'tech' && (<>
      {/* Main Content */}
      <div className="min-w-0 space-y-5">
          {/* Featured Posts */}
          <section className={cn(glassPanelStrongClass, "rounded-3xl border border-white/60 p-4 md:p-5")}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Featured
              </h2>
            </div>
            {loadingFeatured ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading featured posts...</span>
              </div>
            ) : featuredBlogPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredBlogPosts.map((post) => (
                  <FeaturedCard key={post.id} post={post} onClick={() => openPostFromBlog(post)} hotThreshold={trendThresholds.hot} trendThreshold={trendThresholds.trend} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">No featured posts yet</div>
            )}
          </section>

          {/* Posts List */}
          <section className={cn(glassPanelStrongClass, "rounded-3xl border border-white/60 p-4 md:p-5")}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Posts
              </h2>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className={cn(BLOG_SORT_TRIGGER_CLASS, "w-[158px] whitespace-nowrap")}>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowUpDown className="h-3 w-3" />
                    <span className="truncate text-foreground max-w-[108px]">{SORT_OPTIONS.find((o) => o.value === sortOrder)?.label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {loadingTech ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading posts...</span>
              </div>
            ) : techBlogPosts.length > 0 ? (
              <div className="space-y-3">
                {techBlogPosts.map((post) => (
                  <PostListItem key={post.id} post={post} onClick={() => openPostFromBlog(post)} hotThreshold={trendThresholds.hot} trendThreshold={trendThresholds.trend} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">No more posts</div>
            )}

            {/* Load more */}
            {techCursor && (
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={loadMoreTech}
                  disabled={loadingMoreTech}
                  variant="outline"
                  className="h-9 gap-2 rounded-xl border-white/60 bg-white/72 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg hover:border-sky-200/80 hover:bg-white/90"
                >
                  {loadingMoreTech ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {loadingMoreTech ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}
          </section>
        </div>

      </>)}{/* end tech view */}
    </div>
    </div>
    </GlassPage>
  );
}
