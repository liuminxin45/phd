import {
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Loader2,
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-8">
        {/* Main: Report list */}
        <div className="flex-1 min-w-0 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm">Loading weekly reports...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground bg-muted/20 rounded-xl">No weekly reports yet</div>
          ) : (
            sortedWeeks.map((weekKey) => {
              const weekPosts = weekGroups[weekKey];
              const [yearStr, weekStr] = weekKey.split('-W');
              return (
                <div key={weekKey} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-white/60 bg-white/72 px-2 py-0.5 text-slate-700">
                      {yearStr}
                    </Badge>
                    <h3 className="text-sm font-semibold text-slate-600">
                      Week {weekStr}
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
                          className={cn(
                            "glass-interactive group cursor-pointer overflow-hidden rounded-2xl border border-white/60 bg-white/68",
                            "shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/52",
                            "transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/82"
                          )}
                        >
                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200/70 bg-sky-50/82 text-sky-700 transition-colors group-hover:bg-sky-500 group-hover:text-white">
                                <ClipboardList className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-foreground group-hover:text-blue-600 transition-colors">
                                    {dateStr} {weekday}
                                  </span>
                                  <Badge variant="secondary" className="h-5 rounded-full border border-sky-200/70 bg-sky-50 px-1.5 text-[10px] text-sky-700 hover:bg-sky-100/80">
                                    Weekly
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
                className="h-9 w-full max-w-xs rounded-xl border border-white/60 bg-white/70 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg transition-all hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/90"
              >
                {loadingMore ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="mr-2 h-4 w-4" />
                )}
                {loadingMore ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
