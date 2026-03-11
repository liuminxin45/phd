import {
  User,
  Calendar,
  Clock,
  ChevronRight,
  ThumbsUp,
  TrendingUp,
  Flame,
  Zap,
} from 'lucide-react';
import type { BlogPost } from '@/lib/blog/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LiquidTooltip } from '@/components/ui/liquid-tooltip';

// ─── TrendIndicator ──────────────────────────────────────────────────────────

export function TrendIndicator({ tokenCount, hotThreshold = 5, trendThreshold = 3 }: { tokenCount: number; hotThreshold?: number; trendThreshold?: number }) {
  if (tokenCount >= hotThreshold) {
    return (
      <Badge variant="destructive" className="gap-1 px-1.5 py-0">
        <Flame className="h-3 w-3" />
      </Badge>
    );
  }
  if (tokenCount >= trendThreshold) {
    return (
      <Badge variant="secondary" className="gap-1 px-1.5 py-0 bg-orange-100 text-orange-700 hover:bg-orange-200">
        <TrendingUp className="h-3 w-3" />
      </Badge>
    );
  }
  if (tokenCount >= 1) {
    return (
      <Badge variant="secondary" className="gap-1 px-1.5 py-0">
        <Zap className="h-3 w-3" />
      </Badge>
    );
  }
  return null;
}

// ─── TagBadge ────────────────────────────────────────────────────────────────

export function TagBadge({ tag }: { tag: string }) {
  return (
    <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground border-border bg-muted/30">
      {tag}
    </Badge>
  );
}

// ─── FeaturedCard ────────────────────────────────────────────────────────────

export function FeaturedCard({ post, onClick, hotThreshold, trendThreshold }: { post: BlogPost; onClick?: () => void; hotThreshold?: number; trendThreshold?: number }) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "glass-interactive group cursor-pointer overflow-hidden rounded-3xl border border-white/60 bg-white/72",
        "shadow-[0_14px_30px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/56",
        "transition-all duration-300 hover:-translate-y-1 hover:border-sky-200/80 hover:bg-white/84 hover:shadow-[0_20px_42px_rgba(15,23,42,0.14)]"
      )}
    >
      <CardContent className="flex h-full flex-col p-5">
        <div className="mb-4 flex items-center justify-end gap-3">
          <TrendIndicator tokenCount={post.tokenCount} hotThreshold={hotThreshold} trendThreshold={trendThreshold} />
        </div>
        <h3 className="mb-3 line-clamp-2 text-lg font-semibold leading-snug text-slate-900 transition-colors group-hover:text-sky-700">
          {post.title}
        </h3>
        <p className="mb-4 flex-1 line-clamp-3 text-sm leading-relaxed text-slate-600">
          {post.summary}
        </p>
        {post.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between border-t border-white/60 pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <User className="h-3 w-3" />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {post.publishedAt}
            </span>
          </div>
          <LiquidTooltip content="Like count">
            <Badge variant="outline" className="h-6 rounded-full border-white/65 bg-white/78 px-2 text-[11px] text-slate-700">
              <ThumbsUp className="mr-1 h-3 w-3" />
              {post.tokenCount}
            </Badge>
          </LiquidTooltip>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PostListItem ────────────────────────────────────────────────────────────

export function PostListItem({ post, onClick, hotThreshold, trendThreshold }: { post: BlogPost; onClick?: () => void; hotThreshold?: number; trendThreshold?: number }) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "glass-interactive group cursor-pointer overflow-hidden rounded-2xl border border-white/60 bg-white/72",
        "shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/56",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/86 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)]"
      )}
    >
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="line-clamp-1 text-base font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                {post.title}
              </h3>
              <div className="shrink-0 flex items-center gap-2">
                <TrendIndicator tokenCount={post.tokenCount} hotThreshold={hotThreshold} trendThreshold={trendThreshold} />
                <ChevronRight className="h-4 w-4 transform text-slate-400/80 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-sky-600" />
              </div>
            </div>
            
            <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
              {post.summary}
            </p>
            
            <div className="flex flex-wrap items-center justify-between gap-y-2 border-t border-white/55 pt-3">
              <div className="flex flex-wrap gap-1.5">
                {post.tags.length > 0 && post.tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
              </div>
              
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {post.author}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {post.publishedAt}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readTime}
                </span>
                <span className="text-border">|</span>
                <LiquidTooltip content="Like count">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <ThumbsUp className="h-3 w-3" />
                    {post.tokenCount}
                  </span>
                </LiquidTooltip>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
