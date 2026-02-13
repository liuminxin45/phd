import { useMemo, useEffect, useRef } from 'react';
import { remarkupToHtml } from '@/lib/parsers/remarkup';
import { httpGet } from '@/lib/httpClient';
import { cn } from '@/lib/utils';

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif',
]);

interface RemarkupRendererProps {
  content: string;
  className?: string;
  /** Use compact prose styling (smaller text, tighter spacing) — suitable for comments/timeline */
  compact?: boolean;
}

const PROSE_BASE = `
  prose prose-neutral max-w-none dark:prose-invert overflow-hidden
  prose-headings:font-bold prose-headings:tracking-tight
  prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:break-all
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
`;

const PROSE_FULL = `
  prose-sm md:prose-base
  prose-h1:text-2xl prose-h1:mt-10 prose-h1:mb-6
  prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
  prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
  prose-p:leading-7 prose-p:mb-4
`;

const PROSE_COMPACT = `
  prose-sm
  prose-h1:text-lg prose-h1:mt-4 prose-h1:mb-2
  prose-h2:text-base prose-h2:mt-3 prose-h2:mb-2
  prose-h3:text-sm prose-h3:mt-2 prose-h3:mb-1
  prose-p:leading-6 prose-p:mb-2
  [&_blockquote]:border-l-4 [&_blockquote]:border-primary/20 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground [&_blockquote]:bg-muted/50 [&_blockquote]:rounded-r
  [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2
  [&_p]:my-1
`;

export function RemarkupRenderer({ content, className, compact = false }: RemarkupRendererProps) {
  const html = useMemo(() => remarkupToHtml(content || ''), [content]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve {F12345} file embeds after HTML renders
  useEffect(() => {
    const container = containerRef.current;
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
        el.textContent = '';
        if (isImage) {
          const sizeAttr = el.dataset.size || '';
          const layoutAttr = el.dataset.layout || '';
          const img = document.createElement('img');
          img.src = info.url;
          img.alt = info.name || `F${fileId}`;
          img.loading = 'lazy';
          if (sizeAttr === 'thumb') img.style.maxWidth = '200px';
          else if (sizeAttr === 'full') img.style.width = '100%';
          else if (parseFloat(sizeAttr) > 0 && parseFloat(sizeAttr) <= 1) img.style.width = `${Math.round(parseFloat(sizeAttr) * 100)}%`;
          else if (parseFloat(sizeAttr) > 1) img.style.maxWidth = `${sizeAttr}px`;
          if (layoutAttr === 'center') img.className = 'phabricator-image-center';
          el.appendChild(img);
        } else {
          const a = document.createElement('a');
          a.href = info.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.className = 'remarkup-file-link';
          a.title = info.name || `F${fileId}`;
          a.textContent = `📎 ${info.name || `F${fileId}`}${info.mimeType ? ` (${info.mimeType})` : ''}`;
          el.appendChild(a);
        }
      } catch {
        // Leave the fallback link
      }
    });
    return () => { cancelled = true; };
  }, [html]);

  const proseClasses = compact
    ? `${PROSE_BASE} ${PROSE_COMPACT}`
    : `${PROSE_BASE} ${PROSE_FULL}`;

  return (
    <div
      ref={containerRef}
      className={cn(proseClasses, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
