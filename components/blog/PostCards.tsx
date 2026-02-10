import {
  User,
  Calendar,
  Clock,
  ChevronRight,
  Star,
  ThumbsUp,
  TrendingUp,
  Flame,
  Zap,
} from 'lucide-react';
import type { BlogPost } from '@/lib/blog/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── TrendIndicator ──────────────────────────────────────────────────────────

export function TrendIndicator({ tokenCount, hotThreshold = 5, trendThreshold = 3 }: { tokenCount: number; hotThreshold?: number; trendThreshold?: number }) {
  if (tokenCount >= hotThreshold) {
    return (
      <Badge variant="destructive" className="gap-1 px-1.5 py-0">
        <Flame className="h-3 w-3" />
        火爆
      </Badge>
    );
  }
  if (tokenCount >= trendThreshold) {
    return (
      <Badge variant="secondary" className="gap-1 px-1.5 py-0 bg-orange-100 text-orange-700 hover:bg-orange-200">
        <TrendingUp className="h-3 w-3" />
        热门
      </Badge>
    );
  }
  if (tokenCount >= 1) {
    return (
      <Badge variant="secondary" className="gap-1 px-1.5 py-0">
        <Zap className="h-3 w-3" />
        常规
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
    <Card onClick={onClick} className="group overflow-hidden cursor-pointer border-t-4 border-t-primary transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
          <TrendIndicator tokenCount={post.tokenCount} hotThreshold={hotThreshold} trendThreshold={trendThreshold} />
        </div>
        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-3 leading-snug">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1 leading-relaxed">
          {post.summary}
        </p>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {post.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border">
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
          <span className="flex items-center gap-1.5 font-medium text-foreground" title="点赞数">
            <ThumbsUp className="h-3 w-3" />
            {post.tokenCount}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PostListItem ────────────────────────────────────────────────────────────

export function PostListItem({ post, onClick, hotThreshold, trendThreshold }: { post: BlogPost; onClick?: () => void; hotThreshold?: number; trendThreshold?: number }) {
  return (
    <Card onClick={onClick} className="group overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {post.title}
              </h3>
              <div className="shrink-0 flex items-center gap-2">
                <TrendIndicator tokenCount={post.tokenCount} hotThreshold={hotThreshold} trendThreshold={trendThreshold} />
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors group-hover:translate-x-0.5 transform duration-200" />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
              {post.summary}
            </p>
            
            <div className="flex flex-wrap items-center justify-between gap-y-2">
              <div className="flex flex-wrap gap-1.5">
                {post.tags.length > 0 && post.tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                <span className="flex items-center gap-1 font-medium text-foreground" title="点赞数">
                  <ThumbsUp className="h-3 w-3" />
                  {post.tokenCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
