import {
  User,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import type { ApiBlogPost } from '@/lib/blog/types';
import { formatEpoch, getWeekday, getISOWeek } from '@/lib/blog/helpers';

export function ReportView({ posts, loading, onLoadMore, hasMore, loadingMore, onPostClick }: {
  posts: ApiBlogPost[];
  loading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onPostClick?: (post: ApiBlogPost) => void;
}) {
  // Group posts by ISO week
  const weekGroups = posts.reduce<Record<string, ApiBlogPost[]>>((acc, post) => {
    const epoch = post.datePublished || post.dateCreated;
    const d = new Date(epoch * 1000);
    const week = getISOWeek(epoch);
    const key = `${d.getFullYear()}-W${week}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});

  const sortedWeeks = Object.keys(weekGroups).sort((a, b) => b.localeCompare(a));

  // Sidebar stats
  const authors = [...new Set(posts.map((p) => p.authorName))];
  const totalPosts = posts.length;

  return (
    <div className="space-y-5">
      <div className="flex gap-6">
        {/* Main: Report list */}
        <div className="flex-1 min-w-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
              <span className="ml-2 text-sm text-neutral-500">加载周报...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-sm text-neutral-400">暂无周报数据</div>
          ) : (
            sortedWeeks.map((weekKey) => {
              const weekPosts = weekGroups[weekKey];
              const [yearStr, weekStr] = weekKey.split('-W');
              return (
                <div key={weekKey}>
                  <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                    {yearStr} 年 第 {weekStr} 周
                  </h3>
                  <div className="space-y-3">
                    {weekPosts.map((post) => {
                      const epoch = post.datePublished || post.dateCreated;
                      const dateStr = formatEpoch(epoch);
                      const weekday = getWeekday(epoch);
                      return (
                        <div
                          key={post.id}
                          onClick={() => onPostClick?.(post)}
                          className="group bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                                <ClipboardList className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-neutral-900">
                                    {dateStr} {weekday}
                                  </span>
                                  <span className="px-1.5 py-0.5 text-xs rounded bg-blue-50 text-blue-600">
                                    周报
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-600 mt-0.5 line-clamp-1">{post.title}</p>
                                <p className="text-xs text-neutral-400 mt-0.5">{post.authorName}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                          </div>
                          {post.summary && (
                            <div className="mt-3 pt-3 border-t border-neutral-100">
                              <p className="text-xs text-neutral-500 line-clamp-2">{post.summary}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Load more */}
          {!loading && hasMore && (
            <div className="flex justify-center">
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {loadingMore ? '加载中...' : '加载更多'}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0 space-y-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-900 mb-3">概览</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">总计</span>
                <span className="font-medium text-neutral-900">{totalPosts} 篇</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-900 mb-3">成员</p>
            <div className="space-y-2">
              {authors.map((name) => (
                <div key={name} className="flex items-center gap-2 px-2 py-1 hover:bg-neutral-50 rounded-md cursor-pointer transition-colors">
                  <div className="h-6 w-6 rounded-full bg-neutral-200 flex items-center justify-center">
                    <User className="h-3 w-3 text-neutral-500" />
                  </div>
                  <span className="text-sm text-neutral-600">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
