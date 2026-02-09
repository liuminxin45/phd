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

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  return (
    <div className="p-6 space-y-6 bg-background min-h-full">
      {/* ── 1. Header ──────────────────────────────────────────────────── */}
      <header className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-neutral-900" />
            <span
              className="text-lg font-semibold text-neutral-900 cursor-pointer hover:text-neutral-700 transition-colors"
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
                <button
                  key={item.label}
                  onClick={() => setCurrentView(item.view)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    currentView === item.view
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors">
                关于
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {(currentView === 'tech' || currentView === 'create') && (
              <button
                onClick={() => setCurrentView(currentView === 'create' ? 'tech' : 'create')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  currentView === 'create'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {currentView === 'create' ? (
                  <><BookOpen className="h-3.5 w-3.5" /> 技术博客</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" /> 创建博客</>
                )}
              </button>
            )}
            {(currentView === 'report' || currentView === 'create-report') && (
              <button
                onClick={() => setCurrentView(currentView === 'create-report' ? 'report' : 'create-report')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  currentView === 'create-report'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {currentView === 'create-report' ? (
                  <><ClipboardList className="h-3.5 w-3.5" /> 周报列表</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" /> 创建周报</>
                )}
              </button>
            )}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="搜索博客..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-neutral-200 rounded-md bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>
      </header>

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
        <CreateReportView onBack={() => setCurrentView('report')} />
      )}

      {/* ── View: Create Blog ──────────────────────────────────────────── */}
      {currentView === 'create' && (
        <CreateBlogView onBack={() => setCurrentView('tech')} />
      )}

      {/* ── View: Tech Blog ──────────────────────────────────────────── */}
      {currentView === 'tech' && (<>

      {/* Hero */}
      <section className="bg-neutral-900 text-white rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-2">Engineering & Technology Blog</h1>
        <p className="text-neutral-400 text-sm max-w-xl mb-5">
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
              <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                精选文章
              </h2>
            </div>
            {loadingFeatured ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                <span className="ml-2 text-sm text-neutral-500">加载精选文章...</span>
              </div>
            ) : featuredBlogPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFeaturedPosts.map((post) => (
                  <FeaturedCard key={post.id} post={post} onClick={() => openPostFromBlog(post)} hotThreshold={trendThresholds.hot} trendThreshold={trendThresholds.trend} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-neutral-400">暂无精选文章</div>
            )}
          </section>

          {/* Filter Bar */}
          <div className="bg-white border border-neutral-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    showFilters || hasActiveFilters
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  筛选
                  {hasActiveFilters && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                      {(selectedCategory ? 1 : 0) + selectedTags.size}
                    </span>
                  )}
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    清除
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-neutral-400" />
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortOrder(opt.value)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      sortOrder === opt.value
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-500 hover:bg-neutral-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expandable filter panel */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-neutral-100 space-y-3">
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1.5">分类（单选）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          selectedCategory === cat
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1.5">标签（多选）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          selectedTags.has(tag)
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Posts List */}
          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-neutral-500" />
              {sortOrder === 'recommended' ? '推荐文章' : sortOrder === 'tokenCount' ? '最多赞文章' : sortOrder === 'oldest' ? '最早文章' : '最新文章'}
            </h2>
            {loadingTech ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                <span className="ml-2 text-sm text-neutral-500">加载文章列表...</span>
              </div>
            ) : filteredTechPosts.length > 0 ? (
              <div className="space-y-3">
                {filteredTechPosts.map((post) => (
                  <PostListItem key={post.id} post={post} onClick={() => openPostFromBlog(post)} hotThreshold={trendThresholds.hot} trendThreshold={trendThresholds.trend} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-neutral-400">暂无更多文章</div>
            )}

            {/* Load more */}
            {techCursor && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={loadMoreTech}
                  disabled={loadingMoreTech}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  {loadingMoreTech ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {loadingMoreTech ? '加载中...' : '加载更多'}
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block w-72 flex-shrink-0 space-y-5">
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-900 mb-2">搜索</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="关键词搜索..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-neutral-200 rounded-md bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-900 mb-3">分类</p>
            <ul className="space-y-1">
              {CATEGORIES.map((cat) => (
                <li key={cat}>
                  <button className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors">
                    <span>{cat}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-900 mb-3">标签云</p>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => (
                <span
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-0.5 text-xs border rounded-md cursor-pointer transition-colors ${
                    selectedTags.has(tag)
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-900 mb-3">最近发布</p>
            <ul className="space-y-3">
              {recentSidebarPosts.map((post) => (
                <li key={post.id} className="group cursor-pointer">
                  <p className="text-sm text-neutral-800 group-hover:text-neutral-600 line-clamp-2 transition-colors">
                    {post.title}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {post.publishedAt}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="bg-white border border-neutral-200 rounded-lg p-5">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <div className="space-y-1">
            <p className="text-sm text-neutral-600">Phabricator Blog</p>
            <p>工程实践与技术分享 · 由 Phabricator 社区驱动</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 hover:text-neutral-600 transition-colors">
              <Rss className="h-3.5 w-3.5" />
              RSS
            </button>
            <span>© 2026 Phabricator Blog</span>
          </div>
        </div>
      </footer>

      </>)}{/* end tech view */}
    </div>
  );
}
