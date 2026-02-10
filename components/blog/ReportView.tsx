import {
  User,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Loader2,
  Calendar,
} from 'lucide-react';
import type { ApiBlogPost } from '@/lib/blog/types';
import { formatEpoch, getWeekday, getISOWeek } from '@/lib/blog/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main: Report list */}
        <div className="flex-1 min-w-0 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm">加载周报...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground bg-muted/20 rounded-xl">暂无周报数据</div>
          ) : (
            sortedWeeks.map((weekKey) => {
              const weekPosts = weekGroups[weekKey];
              const [yearStr, weekStr] = weekKey.split('-W');
              return (
                <div key={weekKey} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-2 py-0.5 bg-muted/50 border-muted">
                      {yearStr}
                    </Badge>
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      第 {weekStr} 周
                    </h3>
                  </div>
                  
                  <div className="grid gap-3">
                    {weekPosts.map((post) => {
                      const epoch = post.datePublished || post.dateCreated;
                      const dateStr = formatEpoch(epoch);
                      const weekday = getWeekday(epoch);
                      return (
                        <Card
                          key={post.id}
                          onClick={() => onPostClick?.(post)}
                          className="group cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-transparent hover:border-l-blue-500"
                        >
                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <ClipboardList className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-foreground group-hover:text-blue-600 transition-colors">
                                    {dateStr} {weekday}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100">
                                    周报
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground/80">{post.authorName}</span>
                                  {post.title && <span className="line-clamp-1 border-l border-border pl-3">{post.title}</span>}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-foreground transition-colors shrink-0" />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Load more */}
          {!loading && hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={onLoadMore}
                disabled={loadingMore}
                variant="outline"
                className="w-full max-w-xs"
              >
                {loadingMore ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="mr-2 h-4 w-4" />
                )}
                {loadingMore ? '加载中...' : '加载更多'}
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block w-72 flex-shrink-0 space-y-6">
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">概览</h3>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded-md">
                <span className="text-muted-foreground">总计发布</span>
                <span className="font-bold text-foreground">{totalPosts} 篇</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">成员</h3>
            </div>
            <CardContent className="p-2 max-h-[400px] overflow-y-auto">
              <div className="space-y-1">
                {authors.map((name) => (
                  <div key={name} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors group">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-foreground/80">{name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
