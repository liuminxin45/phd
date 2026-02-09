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

// ─── TrendIndicator ──────────────────────────────────────────────────────────

export function TrendIndicator({ tokenCount, hotThreshold = 5, trendThreshold = 3 }: { tokenCount: number; hotThreshold?: number; trendThreshold?: number }) {
  if (tokenCount >= hotThreshold) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600" title={`${tokenCount} 个赞`}>
        <Flame className="h-3 w-3" />
        火爆
      </span>
    );
  }
  if (tokenCount >= trendThreshold) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-600" title={`${tokenCount} 个赞`}>
        <TrendingUp className="h-3 w-3" />
        热门
      </span>
    );
  }
  if (tokenCount >= 1) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-500" title={`${tokenCount} 个赞`}>
        <Zap className="h-3 w-3" />
        常规
      </span>
    );
  }
  return null;
}

// ─── TagBadge ────────────────────────────────────────────────────────────────

export function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-neutral-50 text-neutral-500 border border-neutral-100">
      {tag}
    </span>
  );
}

// ─── FeaturedCard ────────────────────────────────────────────────────────────

export function FeaturedCard({ post, onClick, hotThreshold, trendThreshold }: { post: BlogPost; onClick?: () => void; hotThreshold?: number; trendThreshold?: number }) {
  return (
    <div onClick={onClick} className="group bg-white border border-neutral-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col">
      <div className="h-1.5 bg-neutral-900" />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          <TrendIndicator tokenCount={post.tokenCount} hotThreshold={hotThreshold} trendThreshold={trendThreshold} />
        </div>
        <h3 className="text-base font-semibold text-neutral-900 group-hover:text-neutral-700 transition-colors line-clamp-2 mb-2">
          {post.title}
        </h3>
        <p className="text-sm text-neutral-500 line-clamp-3 mb-3 flex-1">
          {post.summary}
        </p>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {post.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-neutral-400 mt-auto pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {post.author}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {post.publishedAt}
            </span>
          </div>
          <span className="flex items-center gap-1" title="点赞数">
            <ThumbsUp className="h-3 w-3" />
            {post.tokenCount}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── PostListItem ────────────────────────────────────────────────────────────

export function PostListItem({ post, onClick, hotThreshold, trendThreshold }: { post: BlogPost; onClick?: () => void; hotThreshold?: number; trendThreshold?: number }) {
  return (
    <div onClick={onClick} className="group bg-white border border-neutral-200 rounded-lg p-5 hover:shadow-sm transition-shadow cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-neutral-700 transition-colors line-clamp-1 mb-1">
            {post.title}
          </h3>
          <p className="text-sm text-neutral-500 line-clamp-2 mb-2">
            {post.summary}
          </p>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {post.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-neutral-400">
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
            <span className="text-neutral-200">|</span>
            <span className="flex items-center gap-1" title="点赞数">
              <ThumbsUp className="h-3 w-3" />
              {post.tokenCount}
            </span>
            <TrendIndicator tokenCount={post.tokenCount} hotThreshold={hotThreshold} trendThreshold={trendThreshold} />
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-300 flex-shrink-0 mt-1 group-hover:text-neutral-500 transition-colors" />
      </div>
    </div>
  );
}
