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
    <div ref={containerRef} className="max-w-4xl mx-auto space-y-6">
      {/* Floating scroll-to-top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed right-6 bottom-6 z-50 h-10 w-10 rounded-full bg-neutral-900 text-white shadow-lg flex items-center justify-center hover:bg-neutral-700 transition-colors"
          title="回到顶部"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </button>

      {/* Article */}
      <article className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="h-1.5 bg-neutral-900" />
        <div className="p-8 md:p-12">
          {/* Tags */}
          {post.projectTags && post.projectTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {post.projectTags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded-md border border-neutral-200">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500 mb-8 pb-6 border-b border-neutral-100">
            <span className="flex items-center gap-1.5">
              {post.authorImage ? (
                <img src={post.authorImage} alt="" className="h-5 w-5 rounded-full" />
              ) : (
                <User className="h-4 w-4" />
              )}
              {post.authorName}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatEpoch(post.datePublished || post.dateCreated)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {readTimeMin} min
            </span>
          </div>

          {/* Body — rendered from Remarkup → HTML */}
          <div
            ref={bodyContainerRef}
            className="prose prose-neutral prose-sm md:prose-base max-w-none
              prose-headings:font-semibold prose-headings:text-neutral-900
              prose-h1:text-xl prose-h1:mt-8 prose-h1:mb-4
              prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3
              prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
              prose-p:text-neutral-700 prose-p:leading-relaxed
              prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
              prose-code:text-sm prose-code:bg-neutral-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-neutral-900 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:max-h-[30rem] prose-pre:overflow-y-auto
              [&_pre]:text-white [&_pre]:leading-snug [&_pre_*]:!text-white [&_pre_code]:text-white [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:leading-snug
              prose-blockquote:border-l-neutral-300 prose-blockquote:text-neutral-600
              prose-img:rounded-lg prose-img:border prose-img:border-neutral-200
              [&_.phabricator-image-center]:mx-auto [&_.phabricator-image-center]:block
              [&_.remarkup-quote]:border-l-4 [&_.remarkup-quote]:border-neutral-300 [&_.remarkup-quote]:pl-4 [&_.remarkup-quote]:py-2 [&_.remarkup-quote]:my-3 [&_.remarkup-quote]:text-neutral-600 [&_.remarkup-quote]:bg-neutral-50 [&_.remarkup-quote]:rounded-r-md
              [&_.remarkup-quote-attribution]:text-xs [&_.remarkup-quote-attribution]:text-neutral-400 [&_.remarkup-quote-attribution]:block [&_.remarkup-quote-attribution]:mb-1
              [&_.remarkup-mention]:text-blue-600 [&_.remarkup-mention]:font-medium
              [&_.remarkup-object-ref]:text-blue-600 [&_.remarkup-object-ref]:font-medium
              [&_.remarkup-callout]:my-3 [&_.remarkup-callout]:p-3 [&_.remarkup-callout]:rounded-lg [&_.remarkup-callout]:text-sm
              [&_.remarkup-callout-note]:bg-blue-50 [&_.remarkup-callout-note]:text-blue-800
              [&_.remarkup-callout-warning]:bg-amber-50 [&_.remarkup-callout-warning]:text-amber-800
              [&_.remarkup-callout-important]:bg-red-50 [&_.remarkup-callout-important]:text-red-800
              [&_.remarkup-callout-tip]:bg-green-50 [&_.remarkup-callout-tip]:text-green-800
              [&_.remarkup-table]:text-sm [&_.remarkup-table_th]:bg-neutral-50 [&_.remarkup-table_th]:px-3 [&_.remarkup-table_th]:py-2 [&_.remarkup-table_td]:px-3 [&_.remarkup-table_td]:py-2
              [&_.remarkup-file-link]:text-blue-600 [&_.remarkup-file-link]:no-underline [&_.remarkup-file-link]:hover:underline
              [&_.remarkup-file-embed_img]:rounded-lg [&_.remarkup-file-embed_img]:border [&_.remarkup-file-embed_img]:border-neutral-200
              prose-table:text-sm prose-th:bg-neutral-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2
            "
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          {/* Like count — end of article */}
          {tokenCount > 0 && (
            <div className="mt-10 pt-6 border-t border-neutral-100 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-50 text-neutral-500 text-sm border border-neutral-200">
                <Heart className="h-4 w-4 text-red-400 fill-red-400" />
                {tokenCount} 人觉得有帮助
              </span>
            </div>
          )}
        </div>
      </article>

      {/* ── Comments Section ─────────────────────────────────────────── */}
      <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="p-6 md:p-8">
          <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2 mb-6">
            <MessageSquare className="h-4 w-4 text-neutral-500" />
            评论 {!commentsLoading && comments.length > 0 && <span className="text-xs font-normal text-neutral-400">({comments.length})</span>}
          </h2>

          {/* Comment input */}
          <div className="mb-6">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="写下你的评论…"
              rows={3}
              className="w-full px-4 py-3 text-sm border border-neutral-200 rounded-lg bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white transition-colors resize-none"
            />
            {commentError && (
              <p className="mt-1 text-xs text-red-500">{commentError}</p>
            )}
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSubmitComment}
                disabled={commentSubmitting || !commentText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {commentSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {commentSubmitting ? '提交中...' : '发表评论'}
              </button>
            </div>
          </div>

          {/* Comments list */}
          {commentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              <span className="ml-2 text-sm text-neutral-400">加载评论...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-sm text-neutral-400">暂无评论，来发表第一条吧</div>
          ) : (
            <div className="space-y-5">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  {c.authorImage ? (
                    <img src={c.authorImage} alt="" className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5 object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-neutral-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-neutral-800">{c.author}</span>
                      <span className="text-xs text-neutral-400">{c.timestamp}</span>
                    </div>
                    <div
                      className="text-sm text-neutral-600 break-words
                        [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:text-neutral-500 [&_blockquote]:bg-neutral-50 [&_blockquote]:rounded-r-md
                        [&_.remarkup-quote]:border-l-4 [&_.remarkup-quote]:border-neutral-300 [&_.remarkup-quote]:pl-3 [&_.remarkup-quote]:py-1 [&_.remarkup-quote]:my-2 [&_.remarkup-quote]:text-neutral-500 [&_.remarkup-quote]:bg-neutral-50 [&_.remarkup-quote]:rounded-r-md
                        [&_.remarkup-quote-attribution]:text-xs [&_.remarkup-quote-attribution]:text-neutral-400 [&_.remarkup-quote-attribution]:block [&_.remarkup-quote-attribution]:mb-1
                        [&_.remarkup-mention]:text-blue-600 [&_.remarkup-mention]:font-medium
                        [&_img]:max-w-full [&_img]:rounded [&_img]:my-2
                        [&_p]:my-1
                      "
                      dangerouslySetInnerHTML={{ __html: remarkupToHtml(c.content || '') }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
