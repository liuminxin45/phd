import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { httpGet, httpPost } from '@/lib/httpClient';
import { remarkupToHtml } from '@/lib/parsers/remarkup';
import {
  User,
  Calendar,
  Clock,
  ArrowLeft,
  ArrowUp,
  Heart,
  MessageSquare,
  Send,
  Loader2,
} from 'lucide-react';
import type { ApiBlogPost } from '@/lib/blog/types';
import { formatEpoch, IMAGE_EXTENSIONS } from '@/lib/blog/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function PostDetailView({ post, onBack }: { post: ApiBlogPost; onBack: () => void }) {
  const readTimeMin = Math.max(1, Math.ceil((post.body || '').length / 250));

  // Convert Remarkup body → HTML
  const bodyHtml = useMemo(() => remarkupToHtml(post.body || ''), [post.body]);

  // Scroll to top on mount
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, []);

  // ── Like count (display only) ──
  const tokenCount = post.tokenCount;

  // ── Resolve file embeds (image vs file) after body renders ──
  const bodyContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = bodyContainerRef.current;
    if (!container) return;
    const embeds = container.querySelectorAll<HTMLElement>('.remarkup-file-embed');
    if (embeds.length === 0) return;

    let cancelled = false;
    embeds.forEach(async (el) => {
      const fileId = el.dataset.fileId;
      if (!fileId) return;
      try {
        const info = await httpGet<{ id: number; name: string; mimeType: string; url: string; isImage?: boolean }>(`/api/files/${fileId}/url`);
        if (cancelled) return;
        const ext = (info.name || '').toLowerCase().split('.').pop() || '';
        const isImage = info.isImage ?? info.mimeType?.startsWith('image/') ?? IMAGE_EXTENSIONS.has(ext);
        if (isImage) {
          const sizeAttr = el.dataset.size || '';
          const layoutAttr = el.dataset.layout || '';
          let style = '';
          if (sizeAttr === 'thumb') style = 'max-width:200px;';
          else if (sizeAttr === 'full') style = 'width:100%;';
          else if (parseFloat(sizeAttr) > 0 && parseFloat(sizeAttr) <= 1) style = `width:${Math.round(parseFloat(sizeAttr) * 100)}%;`;
          else if (parseFloat(sizeAttr) > 1) style = `max-width:${sizeAttr}px;`;
          const cls = layoutAttr === 'center' ? 'phabricator-image-center' : '';
          el.innerHTML = `<img src="${info.url}" alt="${info.name || `F${fileId}`}" style="${style}" class="${cls}" loading="lazy" />`;
        } else {
          const sizeStr = info.mimeType ? ` (${info.mimeType})` : '';
          el.innerHTML = `<a href="${info.url}" target="_blank" rel="noopener" class="remarkup-file-link" title="${info.name || `F${fileId}`}">📎 ${info.name || `F${fileId}`}${sizeStr}</a>`;
        }
      } catch {
        // Leave the fallback link
      }
    });
    return () => { cancelled = true; };
  }, [bodyHtml]);

  // ── Comment state ──
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');

  // Fetch comments on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCommentsLoading(true);
      try {
        const res = await httpGet<{ comments: any[] }>('/api/blogs/comment', { postPHID: post.phid });
        if (!cancelled) setComments(res.comments || []);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [post.phid]);

  // Submit comment
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
      setCommentError(err.message || '评论提交失败');
    } finally {
      setCommentSubmitting(false);
    }
  };

  // ── Scroll-to-top button visibility ──
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

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Floating scroll-to-top button */}
      {showScrollTop && (
        <Button
          size="icon"
          onClick={scrollToTop}
          className="fixed right-8 bottom-8 z-50 rounded-full shadow-lg"
          title="回到顶部"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}

      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground pl-0 hover:bg-transparent"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回列表
      </Button>

      {/* Article */}
      <Card className="overflow-hidden border-none shadow-sm">
        <div className="h-1.5 bg-primary w-full" />
        <CardContent className="p-8 md:p-12">
          {/* Tags */}
          {post.projectTags && post.projectTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {post.projectTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-2.5 py-0.5 text-xs font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight tracking-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-10 pb-8 border-b border-border">
            <span className="flex items-center gap-2">
              {post.authorImage ? (
                <img src={post.authorImage} alt="" className="h-6 w-6 rounded-full ring-2 ring-background" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
              <span className="font-medium text-foreground">{post.authorName}</span>
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatEpoch(post.datePublished || post.dateCreated)}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {readTimeMin} min read
            </span>
          </div>

          {/* Body — rendered from Remarkup → HTML */}
          <div
            ref={bodyContainerRef}
            className="prose prose-neutral prose-sm md:prose-base max-w-none dark:prose-invert
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h1:text-2xl prose-h1:mt-10 prose-h1:mb-6
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:leading-7 prose-p:mb-4
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-code:text-sm prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-muted/80 prose-pre:text-foreground prose-pre:rounded-lg prose-pre:border prose-pre:border-border
              [&_pre_code]:bg-transparent [&_pre_code]:text-foreground [&_pre_code]:p-0
              prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
              prose-img:rounded-lg prose-img:border prose-img:border-border prose-img:shadow-sm
              [&_.phabricator-image-center]:mx-auto [&_.phabricator-image-center]:block
              [&_.remarkup-callout]:my-4 [&_.remarkup-callout]:p-4 [&_.remarkup-callout]:rounded-lg [&_.remarkup-callout]:text-sm [&_.remarkup-callout]:border
              [&_.remarkup-callout-note]:bg-blue-50 [&_.remarkup-callout-note]:text-blue-900 [&_.remarkup-callout-note]:border-blue-100
              [&_.remarkup-callout-warning]:bg-amber-50 [&_.remarkup-callout-warning]:text-amber-900 [&_.remarkup-callout-warning]:border-amber-100
              [&_.remarkup-callout-important]:bg-red-50 [&_.remarkup-callout-important]:text-red-900 [&_.remarkup-callout-important]:border-red-100
              [&_.remarkup-callout-tip]:bg-green-50 [&_.remarkup-callout-tip]:text-green-900 [&_.remarkup-callout-tip]:border-green-100
              prose-table:text-sm prose-th:bg-muted/50 prose-th:p-3 prose-td:p-3 prose-td:border-b
            "
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          {/* Like count — end of article */}
          {tokenCount > 0 && (
            <div className="mt-12 pt-8 border-t border-border flex items-center justify-center">
              <Badge variant="outline" className="gap-2 px-4 py-1.5 text-sm font-normal rounded-full bg-muted/30">
                <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                <span className="font-medium text-foreground">{tokenCount}</span> 人觉得有帮助
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Comments Section ─────────────────────────────────────────── */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-8 md:p-10">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-8">
            <MessageSquare className="h-5 w-5 text-primary" />
            评论 {!commentsLoading && comments.length > 0 && <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>}
          </h2>

          {/* Comment input */}
          <div className="mb-10 bg-muted/30 rounded-xl p-4 border border-border/50">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="写下你的评论…"
              rows={3}
              className="w-full bg-transparent border-none outline-none resize-none text-sm placeholder:text-muted-foreground focus-visible:ring-0 p-0 shadow-none min-h-[80px]"
            />
            {commentError && (
              <p className="mt-2 text-xs text-destructive font-medium">{commentError}</p>
            )}
            <div className="flex justify-end mt-3 pt-3 border-t border-border/50">
              <Button
                onClick={handleSubmitComment}
                disabled={commentSubmitting || !commentText.trim()}
                size="sm"
                className="gap-2"
              >
                {commentSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {commentSubmitting ? '提交中...' : '发表评论'}
              </Button>
            </div>
          </div>

          {/* Comments list */}
          {commentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-3 text-sm text-muted-foreground">加载评论...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
              暂无评论，来发表第一条吧
            </div>
          ) : (
            <div className="space-y-8">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-4 group">
                  {c.authorImage ? (
                    <img src={c.authorImage} alt="" className="h-10 w-10 rounded-full flex-shrink-0 mt-1 object-cover ring-2 ring-background shadow-sm" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1 ring-2 ring-background shadow-sm">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground">{c.author}</span>
                      <span className="text-xs text-muted-foreground">{c.timestamp}</span>
                    </div>
                    <div
                      className="text-sm text-foreground/90 leading-relaxed bg-muted/20 p-4 rounded-r-xl rounded-bl-xl
                        [&_blockquote]:border-l-4 [&_blockquote]:border-primary/20 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground [&_blockquote]:bg-muted/50 [&_blockquote]:rounded-r
                        [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2
                        [&_p]:my-1
                      "
                      dangerouslySetInnerHTML={{ __html: remarkupToHtml(c.content || '') }}
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
