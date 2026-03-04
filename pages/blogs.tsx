import { useState, useEffect, useCallback, useMemo } from 'react';
import { httpGet } from '@/lib/httpClient';
import {
  Search,
  Clock,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  Rss,
  BookOpen,
  Star,
  Calendar,
  Filter,
  X,
  Plus,
  ClipboardList,
  Loader2,
  ThumbsUp,
} from 'lucide-react';

import type { ApiBlogPost, BlogPost, PostsResponse } from '@/lib/blog/types';
import {
  CATEGORIES,
  SORT_OPTIONS,
  apiPostToBlogPost,
  computeTrendThresholds,
} from '@/lib/blog/helpers';

import { LandingView } from '@/components/blog/LandingView';
import { ReportView } from '@/components/blog/ReportView';
import { PostDetailView } from '@/components/blog/PostDetailView';
import { CreateBlogView, CreateReportView } from '@/components/blog/BlogEditor';
import { FeaturedCard, PostListItem } from '@/components/blog/PostCards';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AutoLikeDialog } from '@/components/blog/AutoLikeDialog';
import { cn } from '@/lib/utils';
import { useAutoLike } from '@/hooks/useAutoLike';

export default function BlogsPage() {
  const [currentView, setCurrentView] = useState<'landing' | 'tech' | 'report' | 'create' | 'create-report' | 'post-detail'>('landing');
  const [previousView, setPreviousView] = useState<string>('tech');
  const [selectedPost, setSelectedPost] = useState<ApiBlogPost | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  // ── API data ──────────────────────────────────────────────
  const [techPosts, setTechPosts] = useState<ApiBlogPost[]>([]);
  const [reportPosts, setReportPosts] = useState<ApiBlogPost[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<ApiBlogPost[]>([]);
  const [loadingTech, setLoadingTech] = useState(true);
  const [loadingReport, setLoadingReport] = useState(true);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingMoreTech, setLoadingMoreTech] = useState(false);
  const [loadingMoreReport, setLoadingMoreReport] = useState(false);
  const [newestTechPosts, setNewestTechPosts] = useState<ApiBlogPost[]>([]);
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

      if (!cancelled) {
        setTechPosts(techRes.data);
        setNewestTechPosts(techRes.data);
        setTechCursor(techRes.cursor.after);
        setLoadingTech(false);

        setReportPosts(reportRes.data);
        setReportCursor(reportRes.cursor.after);
        setLoadingReport(false);

        setFeaturedPosts(featuredRes.data);
        setLoadingFeatured(false);
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
        setTechPosts(techRes.data);
        setNewestTechPosts(techRes.data);
        setTechCursor(techRes.cursor.after);
        setFeaturedPosts(featuredRes.data);
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
  const recentSidebarPosts = newestTechPosts.slice(0, 4).map(apiPostToBlogPost);

  // Dynamic trend thresholds
  const trendThresholds = useMemo(() => computeTrendThresholds(techBlogPosts), [techBlogPosts]);

  // Dynamic tags from current posts
  const availableTags = [...new Set(techBlogPosts.flatMap((p) => p.tags))].sort();

  // Apply tag filter
  const filteredTechPosts = selectedTags.size > 0
    ? techBlogPosts.filter((p) => p.tags.some((t) => selectedTags.has(t)))
    : techBlogPosts;
  const filteredFeaturedPosts = selectedTags.size > 0
    ? featuredBlogPosts.filter((p) => p.tags.some((t) => selectedTags.has(t)))
    : featuredBlogPosts;

  // Open post detail
  const openPost = useCallback((post: ApiBlogPost) => {
    setPreviousView(currentView);
    setSelectedPost(post);
    setCurrentView('post-detail');
  }, [currentView]);
  const openPostFromBlog = useCallback((blogPost: BlogPost) => {
    const apiPost = techPosts.find((p) => p.id === blogPost.id) || reportPosts.find((p) => p.id === blogPost.id) || featuredPosts.find((p) => p.id === blogPost.id);
    if (apiPost) { setPreviousView(currentView); setSelectedPost(apiPost); setCurrentView('post-detail'); }
  }, [techPosts, reportPosts, featuredPosts, currentView]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedTags(new Set());
    setSortOrder('newest');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory || selectedTags.size > 0 || (sortOrder !== 'newest' && sortOrder !== 'recommended');
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
    <div className="p-6 space-y-6 bg-background min-h-full">
      {/* ── 1. Header ──────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-foreground" />
            <span
              className="text-lg font-semibold text-foreground cursor-pointer hover:text-muted-foreground transition-colors"
              onClick={() => setCurrentView('landing')}
            >
              Phabricator Blog
            </span>
            <nav className="hidden md:flex items-center gap-1 ml-4">
              {[
                { label: '首页', view: 'landing' as const },
                { label: '技术博客', view: 'tech' as const },
                { label: '周报', view: 'report' as const },
              ].map((item) => (
                <Button
                  key={item.label}
                  onClick={() => setCurrentView(item.view)}
                  variant={currentView === item.view ? 'default' : 'ghost'}
                  size="sm"
                  className="text-sm"
                >
                  {item.label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground">
                关于
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {(currentView === 'tech' || currentView === 'create') && (
              <Button
                onClick={() => setAutoLikeDialogOpen(true)}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <ThumbsUp className="h-3.5 w-3.5" /> 随机点赞
              </Button>
            )}
            {(currentView === 'tech' || currentView === 'create') && (
              <Button
                onClick={() => setCurrentView(currentView === 'create' ? 'tech' : 'create')}
                variant={currentView === 'create' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
              >
                {currentView === 'create' ? (
                  <><BookOpen className="h-3.5 w-3.5" /> 技术博客</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" /> 创建博客</>
                )}
              </Button>
            )}
            {(currentView === 'report' || currentView === 'create-report') && (
              <Button
                onClick={() => setCurrentView(currentView === 'create-report' ? 'report' : 'create-report')}
                variant={currentView === 'create-report' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
              >
                {currentView === 'create-report' ? (
                  <><ClipboardList className="h-3.5 w-3.5" /> 周报列表</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" /> 创建周报</>
                )}
              </Button>
            )}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜索博客..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
        <LandingView onNavigate={(view) => setCurrentView(view)} techPosts={techPosts} reportPosts={reportPosts} loading={loadingTech || loadingReport} />
      )}

      {/* ── View: Post Detail ──────────────────────────────────────────── */}
      {currentView === 'post-detail' && selectedPost && (
        <PostDetailView
          post={selectedPost}
          onBack={() => { setSelectedPost(null); setCurrentView(previousView as any); }}
        />
      )}

      {/* ── View: Report ─────────────────────────────────────────────── */}
      {currentView === 'report' && (
        <ReportView posts={reportPosts} loading={loadingReport} onLoadMore={loadMoreReport} hasMore={!!reportCursor} loadingMore={loadingMoreReport} onPostClick={openPost} />
      )}

      {/* ── View: Create Report ────────────────────────────────────────── */}
      {currentView === 'create-report' && (
        <CreateReportView
          onBack={() => setCurrentView('report')}
          onPublished={() => refreshPostsAfterPublish('report')}
        />
      )}

      {/* ── View: Create Blog ──────────────────────────────────────────── */}
      {currentView === 'create' && (
        <CreateBlogView
          onBack={() => setCurrentView('tech')}
          onPublished={() => refreshPostsAfterPublish('tech')}
        />
      )}

      {/* ── View: Tech Blog ──────────────────────────────────────────── */}
      {currentView === 'tech' && (<>

      {/* Hero */}
      <section className="bg-foreground text-background rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-2">Engineering & Technology Blog</h1>
        <p className="text-muted-foreground/80 text-sm max-w-xl mb-5">
          来自 Phabricator 社区的工程实践、架构设计与技术深度文章。记录我们在构建大规模系统过程中的思考与经验。
        </p>
      </section>

      {/* Content + Sidebar */}
      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Featured Posts */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                精选文章
              </h2>
            </div>
            {loadingFeatured ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">加载精选文章...</span>
              </div>
            ) : featuredBlogPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFeaturedPosts.map((post) => (
                  <FeaturedCard key={post.id} post={post} onClick={() => openPostFromBlog(post)} hotThreshold={trendThresholds.hot} trendThreshold={trendThresholds.trend} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">暂无精选文章</div>
            )}
          </section>

          {/* Filter Bar */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowFilters(!showFilters)}
                    variant={showFilters || hasActiveFilters ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5 h-8"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    筛选
                    {hasActiveFilters && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                        {(selectedCategory ? 1 : 0) + selectedTags.size}
                      </span>
                    )}
                  </Button>
                  {hasActiveFilters && (
                    <Button
                      onClick={clearFilters}
                      variant="ghost"
                      size="sm"
                      className="gap-1 h-8 text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                      清除
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  {SORT_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      onClick={() => setSortOrder(opt.value)}
                      variant={sortOrder === opt.value ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 text-xs"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Expandable filter panel */}
              {showFilters && (
                <div className="mt-3 pt-3 border-t border-border space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">分类（单选）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => (
                        <Button
                          key={cat}
                          onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                          variant={selectedCategory === cat ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                        >
                          {cat}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">标签（多选）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map((tag) => (
                        <Button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          variant={selectedTags.has(tag) ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                        >
                          {tag}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Posts List */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {sortOrder === 'recommended' ? '推荐文章' : sortOrder === 'tokenCount' ? '最多赞文章' : sortOrder === 'oldest' ? '最早文章' : '最新文章'}
            </h2>
            {loadingTech ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">加载文章列表...</span>
              </div>
            ) : filteredTechPosts.length > 0 ? (
              <div className="space-y-3">
                {filteredTechPosts.map((post) => (
                  <PostListItem key={post.id} post={post} onClick={() => openPostFromBlog(post)} hotThreshold={trendThresholds.hot} trendThreshold={trendThresholds.trend} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">暂无更多文章</div>
            )}

            {/* Load more */}
            {techCursor && (
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={loadMoreTech}
                  disabled={loadingMoreTech}
                  variant="outline"
                  className="gap-2"
                >
                  {loadingMoreTech ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {loadingMoreTech ? '加载中...' : '加载更多'}
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block w-72 flex-shrink-0 space-y-5">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-2">搜索</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="关键词搜索..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3">分类</p>
              <ul className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <li key={cat}>
                    <Button variant="ghost" className="w-full justify-between h-8 px-2 text-sm text-muted-foreground hover:text-foreground">
                      <span>{cat}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3">标签云</p>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.has(tag) ? 'default' : 'outline'}
                    className="cursor-pointer font-normal"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3">最近发布</p>
              <ul className="space-y-3">
                {recentSidebarPosts.map((post) => (
                  <li key={post.id} className="group cursor-pointer">
                    <p className="text-sm text-foreground/90 group-hover:text-primary line-clamp-2 transition-colors">
                      {post.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {post.publishedAt}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Footer */}
      <Card>
        <CardContent className="p-5 flex items-center justify-between text-xs text-muted-foreground">
          <div className="space-y-1">
            <p className="text-sm text-foreground/80">Phabricator Blog</p>
            <p>工程实践与技术分享 · 由 Phabricator 社区驱动</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Rss className="h-3.5 w-3.5" />
              RSS
            </button>
            <span>© 2026 Phabricator Blog</span>
          </div>
        </CardContent>
      </Card>

      </>)}{/* end tech view */}
    </div>
  );
}
