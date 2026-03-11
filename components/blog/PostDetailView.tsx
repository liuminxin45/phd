import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { httpGet, httpPost } from '@/lib/httpClient';
import { RemarkupRenderer } from '@/components/ui/RemarkupRenderer';
import {
  User,
  Calendar,
  Clock,
  FileText,
  ArrowLeft,
  ArrowUp,
  Heart,
  MessageSquare,
  Send,
  Loader2,
} from 'lucide-react';
import type { ApiBlogPost } from '@/lib/blog/types';
import { formatEpoch } from '@/lib/blog/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { glassPanelStrongClass } from '@/components/ui/glass';
import { LiquidTooltip } from '@/components/ui/liquid-tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/lib/toast';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface LikeUser {
  phid: string;
  name: string;
  image: string | null;
}

export function PostDetailView({
  post,
  onBack,
  canLike = true,
}: {
  post: ApiBlogPost;
  onBack: () => void;
  canLike?: boolean;
}) {
  const readTimeMin = Math.max(1, Math.ceil((post.body || '').length / 250));
  const wordCount = (post.body || '').replace(/\s+/g, '').length;

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, []);

  const tokenCount = post.tokenCount;
  const articleBodyRef = useRef<HTMLDivElement | null>(null);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [portalReady, setPortalReady] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(tokenCount);
  const [likers, setLikers] = useState<LikeUser[]>([]);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeStateLoading, setLikeStateLoading] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCommentsLoading(true);
      try {
        const res = await httpGet<{ comments: any[] }>('/api/blogs/comment', { postPHID: post.phid });
        if (!cancelled) setComments(res.comments || []);
      } catch {
        // ignore on read
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [post.phid]);

  useEffect(() => {
    setLikeCount(tokenCount);
  }, [tokenCount]);

  useEffect(() => {
    if (!canLike) return;
    let cancelled = false;
    (async () => {
      setLikeStateLoading(true);
      try {
        const res = await httpGet<{ hasLiked?: boolean; likeCount?: number; likers?: LikeUser[] }>(
          '/api/blogs/token',
          { objectPHID: post.phid }
        );
        if (cancelled) return;
        setHasLiked(Boolean(res.hasLiked));
        setLikeCount(typeof res.likeCount === 'number' ? res.likeCount : tokenCount);
        setLikers(Array.isArray(res.likers) ? res.likers : []);
      } catch {
        if (!cancelled) {
          setHasLiked(false);
          setLikeCount(tokenCount);
          setLikers([]);
        }
      } finally {
        if (!cancelled) setLikeStateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canLike, post.phid, tokenCount]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    setCommentError('');
    try {
      await httpPost('/api/blogs/comment', { postId: post.id, content: commentText.trim() });
      setCommentText('');
      const res = await httpGet<{ comments: any[] }>('/api/blogs/comment', { postPHID: post.phid });
      setComments(res.comments || []);
    } catch (err: any) {
      setCommentError(err.message || 'Failed to submit comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const scrollParent = document.querySelector('[data-blog-scroll]') || document.documentElement;
    const handleScroll = () => {
      const target = scrollParent === document.documentElement ? window.scrollY : (scrollParent as HTMLElement).scrollTop;
      setShowScrollTop(target > 400);
    };
    const el = scrollParent === document.documentElement ? window : scrollParent;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const scrollParent = document.querySelector('[data-blog-scroll]');
    if (scrollParent) {
      scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLike = async () => {
    if (!canLike || likeLoading || hasLiked) return;
    setLikeLoading(true);
    try {
      const res = await httpPost<{
        status?: string;
        likeCountAfter?: number;
        likers?: LikeUser[];
      }>('/api/blogs/token', { objectPHID: post.phid });
      const status = res?.status || 'liked';
      if (status === 'already-liked') {
        setHasLiked(true);
        if (typeof res.likeCountAfter === 'number') setLikeCount(res.likeCountAfter);
        if (Array.isArray(res.likers)) setLikers(res.likers);
        toast.info('You already liked this post');
        return;
      }
      setHasLiked(true);
      if (typeof res.likeCountAfter === 'number') {
        setLikeCount(res.likeCountAfter);
      } else {
        setLikeCount((prev) => prev + 1);
      }
      if (Array.isArray(res.likers)) {
        setLikers(res.likers);
      } else {
        setLikers((prev) => prev);
      }
      toast.success('Liked');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to like post');
    } finally {
      setLikeLoading(false);
    }
  };

  const likerPopupContent = (
    <div className="max-w-[260px] space-y-2">
      <p className="text-[11px] font-semibold text-slate-700">Liked by</p>
      {likeStateLoading ? (
        <p className="text-[11px] text-slate-500">Loading...</p>
      ) : likers.length === 0 ? (
        <p className="text-[11px] text-slate-500">No likes yet</p>
      ) : (
        <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
          {likers.map((user) => (
            <div key={user.phid} className="flex items-center gap-2 rounded-lg border border-white/45 bg-white/70 px-2 py-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={user.image || ''} alt={user.name} />
                <AvatarFallback className="text-[9px]">{user.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-[11px] text-slate-700">{user.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const root = articleBodyRef.current;
      if (!root) {
        setTocItems([]);
        return;
      }

      const headingNodes = Array.from(root.querySelectorAll('h1, h2, h3, h4')) as HTMLElement[];
      const nextToc: TocItem[] = headingNodes
        .map((node, index) => {
          const text = node.textContent?.trim() || '';
          if (!text) return null;
          const id = `post-heading-${index + 1}`;
          node.id = id;
          return {
            id,
            text,
            level: Number(node.tagName.replace('H', '')) || 2,
          };
        })
        .filter((item): item is TocItem => item !== null);

      setTocItems(nextToc);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [post.id, post.body]);

  return (
    <div ref={containerRef} className="mx-auto max-w-4xl space-y-6 py-4">
      {portalReady && tocItems.length > 0 && createPortal(
        <div className="fixed left-[88px] top-1/2 z-[90] flex -translate-y-1/2 xl:left-[104px]">
          <div className="flex h-[66vh] flex-col items-start justify-around rounded-2xl border border-white/55 bg-white/64 px-2 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/48">
            {tocItems.map((item) => (
              <LiquidTooltip key={item.id} content={item.text} side="right">
                <button
                  type="button"
                  onClick={() => {
                    const target = document.getElementById(item.id);
                    if (target) {
                      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  aria-label={item.text}
                  className="group flex h-6 items-center rounded-full bg-transparent py-2"
                >
                  <span
                    className="block h-[2px] rounded-full bg-sky-500/80 transition-all group-hover:bg-sky-600"
                    style={{ width: `${Math.max(8, 52 - item.level * 14)}px` }}
                  />
                </button>
              </LiquidTooltip>
            ))}
          </div>
        </div>,
        document.body
      )}

      {showScrollTop && (
        <Button
          size="icon"
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 h-10 w-10 rounded-xl border border-white/55 bg-white/72 text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/90"
          title="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="h-9 w-9 rounded-xl border border-white/55 bg-white/72 text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/90 hover:text-slate-900"
        title="Back to list"
        aria-label="Back to list"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <Card className={`overflow-hidden rounded-3xl border border-white/65 bg-white/74 shadow-[0_20px_44px_rgba(15,23,42,0.12)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/56 ${glassPanelStrongClass}`}>
        <div className="h-1.5 w-full bg-gradient-to-r from-sky-500/70 via-blue-500/70 to-indigo-500/70" />
        <CardContent className="p-6 md:p-10">
          {post.projectTags && post.projectTags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {post.projectTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="rounded-full border border-white/65 bg-white/78 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">
            {post.title}
          </h1>

          <div className="mb-9 flex flex-wrap items-center gap-5 border-b border-white/60 pb-6 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              {post.authorImage ? (
                <img src={post.authorImage} alt="" className="h-6 w-6 rounded-full ring-2 ring-white/80" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/75">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
              <span className="font-medium text-slate-900">{post.authorName}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatEpoch(post.datePublished || post.dateCreated)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {readTimeMin} min read
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              {wordCount.toLocaleString()} words
            </span>
          </div>

          <div ref={articleBodyRef}>
            <RemarkupRenderer content={post.body || ''} />
          </div>

          {canLike && (
            <div className="mt-10 flex items-center justify-center border-t border-white/60 pt-7">
              <LiquidTooltip content={likerPopupContent}>
                <button
                  type="button"
                  onClick={handleLike}
                  disabled={likeLoading || hasLiked}
                  className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/72 px-4 py-1.5 text-sm text-slate-700 transition-all hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/88 disabled:cursor-default disabled:opacity-90"
                >
                  {likeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                  ) : (
                    <Heart className={`h-4 w-4 ${hasLiked ? 'fill-rose-500 text-rose-500' : 'text-rose-500'}`} />
                  )}
                  <span className="font-semibold text-slate-900">{likeCount}</span> found this useful
                </button>
              </LiquidTooltip>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-white/65 bg-white/74 shadow-[0_20px_44px_rgba(15,23,42,0.12)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/56">
        <CardContent className="p-6 md:p-8">
          <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <MessageSquare className="h-5 w-5 text-sky-700" />
            Comments {!commentsLoading && comments.length > 0 && <span className="text-sm font-normal text-slate-500">({comments.length})</span>}
          </h2>

          <div className="mb-8 rounded-2xl border border-white/60 bg-white/72 p-4">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              className="min-h-[80px] resize-none border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
            {commentError && <p className="mt-2 text-xs font-medium text-rose-600">{commentError}</p>}
            <div className="mt-3 flex justify-end border-t border-white/55 pt-3">
              <Button
                onClick={handleSubmitComment}
                disabled={commentSubmitting || !commentText.trim()}
                size="sm"
                className="gap-2 rounded-xl"
              >
                {commentSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {commentSubmitting ? 'Submitting...' : 'Post'}
              </Button>
            </div>
          </div>

          {commentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              <span className="ml-3 text-sm text-slate-500">Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/65 bg-white/58 py-10 text-center text-sm text-slate-500">
              No comments yet
            </div>
          ) : (
            <div className="space-y-6">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-4">
                  {c.authorImage ? (
                    <img src={c.authorImage} alt="" className="mt-1 h-9 w-9 flex-shrink-0 rounded-full object-cover ring-2 ring-white/80 shadow-sm" />
                  ) : (
                    <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/75 ring-2 ring-white/80 shadow-sm">
                      <User className="h-4.5 w-4.5 text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-slate-900">{c.author}</span>
                      <span className="text-xs text-slate-500">{c.timestamp}</span>
                    </div>
                    <RemarkupRenderer
                      content={c.content || ''}
                      compact
                      className="rounded-2xl border border-white/58 bg-white/72 p-4 text-sm leading-relaxed text-slate-800"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
