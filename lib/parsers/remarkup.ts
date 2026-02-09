/**
 * Convert Phabricator Remarkup syntax to HTML.
 *
 * Supported syntax:
 *   = h1 =   == h2 ==   === h3 ===   ==== h4 ====
 *   **bold**   //italic//   ~~strikethrough~~   `monospace`
 *   {F12345}  {F12345,size=full}          → image references
 *   {T12345}                               → task links
 *   {D12345}                               → diff links
 *   [[url|label]]  [[url]]                 → links
 *   @username                              → mention
 *   >>! ... (nested quote with attribution)
 *   > blockquote lines
 *   ```lang ... ```                        → fenced code blocks
 *   - / * unordered list items
 *   # ordered list items
 *   | table | rows |                       → tables
 *   NOTE: / WARNING: / IMPORTANT:          → callout blocks
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function remarkupToHtml(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // ── 1. Fenced code blocks — protect from other transforms
  // Handles: ```lang  or  ```lang=javascript,lines=100  or  ```
  const codeBlocks: string[] = [];
  text = text.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_m, meta: string, code: string) => {
    const idx = codeBlocks.length;
    const escaped = escapeHtml(code.replace(/\n$/, ''));
    // Extract language from meta: "lang=javascript,lines=100" → "javascript", or plain "javascript"
    let lang = 'text';
    const metaTrimmed = meta.trim();
    if (metaTrimmed) {
      const langParam = metaTrimmed.match(/^(?:lang=)?(\w+)/);
      if (langParam) lang = langParam[1];
    }
    codeBlocks.push(
      `<pre class="remarkup-code"><code class="language-${lang}">${escaped}</code></pre>`
    );
    return `\x00CODEBLOCK_${idx}\x00`;
  });

  // ── 2. Inline code `...` — protect from other transforms
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code class="remarkup-inline-code">${escapeHtml(code)}</code>`);
    return `\x00INLINECODE_${idx}\x00`;
  });

  // ── 3. File references: {F12345} / {F12345,size=full,layout=center}
  // Renders as a smart placeholder; client-side JS resolves image vs file
  text = text.replace(
    /\{F(\d+)(?:,([^}]+))?\}/g,
    (_match, id: string, opts: string | undefined) => {
      let sizeAttr = '';
      let layoutAttr = '';
      if (opts) {
        const params = Object.fromEntries(
          opts.split(',').map(s => {
            const [k, ...v] = s.trim().split('=');
            return [k.trim(), v.join('=').trim()];
          })
        );
        if (params.size) sizeAttr = ` data-size="${params.size}"`;
        if (params.layout) layoutAttr = ` data-layout="${params.layout}"`;
      }
      return `<span class="remarkup-file-embed" data-file-id="${id}"${sizeAttr}${layoutAttr}><a href="/api/files/${id}/raw" target="_blank" rel="noopener" class="remarkup-file-link">📎 F${id}</a></span>`;
    }
  );

  // ── 4. Object references: {T123}, {D123}, {P123}, etc.
  text = text.replace(/\{T(\d+)\}/g, '<a href="/task/$1" class="remarkup-object-ref">T$1</a>');
  text = text.replace(/\{D(\d+)\}/g, '<a href="/D$1" class="remarkup-object-ref">D$1</a>');

  // ── 5. Wiki-style links: [[url|label]] or [[url]]
  text = text.replace(/\[\[([^|\]\n]+)\|([^\]\n]+)\]\]/g, '<a href="$1" class="remarkup-link">$2</a>');
  text = text.replace(/\[\[([^\]\n]+)\]\]/g, '<a href="$1" class="remarkup-link">$1</a>');

  // ── 6. @mentions
  text = text.replace(/@([a-zA-Z0-9_.-]+)/g, '<span class="remarkup-mention">@$1</span>');

  // ── 7. Process line-by-line for block elements
  const lines = text.split('\n');
  const out: string[] = [];
  let inQuote = false;
  let quoteLines: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableRows: string[] = [];

  const flushQuote = () => {
    if (quoteLines.length > 0) {
      out.push(`<blockquote class="remarkup-quote">${quoteLines.join('<br/>')}</blockquote>`);
      quoteLines = [];
    }
    inQuote = false;
  };

  const flushUl = () => { if (inUl) { out.push('</ul>'); inUl = false; } };
  const flushOl = () => { if (inOl) { out.push('</ol>'); inOl = false; } };
  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      out.push('<table class="remarkup-table"><tbody>');
      out.push(...tableRows);
      out.push('</tbody></table>');
      tableRows = [];
    }
    inTable = false;
  };

  const flushAll = () => { flushQuote(); flushUl(); flushOl(); flushTable(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Headings: =h1= ==h2== ===h3=== (spaces around content are optional)
    const headingMatch = line.match(/^(={1,6})\s*(.+?)\s*\1\s*$/);
    if (headingMatch) {
      flushAll();
      const level = Math.min(headingMatch[1].length, 6);
      out.push(`<h${level}>${headingMatch[2]}</h${level}>`);
      continue;
    }

    // ── Markdown-style headings: ## h2, ### h3, #### h4 etc. (single # reserved for ordered list)
    const mdHeadingMatch = line.match(/^(#{2,6})\s*(.+?)\s*$/);
    if (mdHeadingMatch) {
      flushAll();
      const level = Math.min(mdHeadingMatch[1].length, 6);
      out.push(`<h${level}>${mdHeadingMatch[2]}</h${level}>`);
      continue;
    }

    // ── Phabricator nested quote >>! ... (with optional attribution)
    // Pattern: >>! In T12345#comment, @user wrote:
    // or just >>! content
    if (line.startsWith('>>!') || line.startsWith('>> !')) {
      flushUl(); flushOl(); flushTable();
      // Start collecting quote block
      const content = line.replace(/^>>!?\s*/, '').replace(/^>>\s*!\s*/, '');
      if (!inQuote) inQuote = true;
      if (content.trim()) {
        // Check for attribution pattern "In XXXX, @user wrote:"
        const attrMatch = content.match(/^In\s+(.+?),\s*@(\S+)\s+wrote:\s*$/i);
        if (attrMatch) {
          quoteLines.push(`<span class="remarkup-quote-attribution"><strong>@${escapeHtml(attrMatch[2])}</strong> 写道：</span>`);
        } else {
          quoteLines.push(content);
        }
      }
      continue;
    }

    // ── Regular blockquote: > line
    if (line.match(/^>\s/)) {
      flushUl(); flushOl(); flushTable();
      inQuote = true;
      quoteLines.push(line.replace(/^>\s?/, ''));
      continue;
    }

    // If we were in a quote and this line is empty or not a quote, flush
    if (inQuote && !line.startsWith('>')) {
      flushQuote();
      // If line is blank, just continue
      if (line.trim() === '') { out.push(''); continue; }
    }

    // ── Table: | col | col |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushQuote(); flushUl(); flushOl();
      inTable = true;
      const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
      // Check if it's a separator row (---|---)
      if (cells.every(c => /^-+$/.test(c))) continue;
      const tag = tableRows.length === 0 ? 'th' : 'td';
      tableRows.push(`<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`);
      continue;
    }
    if (inTable) flushTable();

    // ── Unordered list: - item or * item (at start of line)
    if (line.match(/^[\-\*]\s+/)) {
      flushQuote(); flushOl(); flushTable();
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${line.replace(/^[\-\*]\s+/, '')}</li>`);
      continue;
    }
    if (inUl) flushUl();

    // ── Ordered list: # item
    if (line.match(/^#\s+/)) {
      flushQuote(); flushUl(); flushTable();
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${line.replace(/^#\s+/, '')}</li>`);
      continue;
    }
    if (inOl) flushOl();

    // ── Horizontal rule
    if (line.match(/^-{3,}\s*$/)) {
      flushAll();
      out.push('<hr/>');
      continue;
    }

    // ── Callout blocks: NOTE: / WARNING: / IMPORTANT: or (NOTE) / (WARNING) / (IMPORTANT) / (TIP)
    const calloutMatch = line.match(/^(NOTE|WARNING|IMPORTANT|TIP):\s*(.*)/i)
      || line.match(/^\((NOTE|WARNING|IMPORTANT|TIP)\)\s*(.*)/i);
    if (calloutMatch) {
      flushAll();
      const type = calloutMatch[1].toLowerCase();
      out.push(`<div class="remarkup-callout remarkup-callout-${type}">${calloutMatch[2]}</div>`);
      continue;
    }

    // ── Empty line → paragraph break
    if (line.trim() === '') {
      flushAll();
      out.push('');
      continue;
    }

    // ── Default: regular text line
    out.push(line);
  }

  flushAll();

  // Join lines, wrapping consecutive non-tag text lines in <p>
  let html = out.join('\n');

  // ── 8. Inline formatting (applied to the whole HTML)
  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // //italic// (but not inside URLs like http://)
  html = html.replace(/(?<![:\w])\/\/(.+?)\/\//g, '<em>$1</em>');
  // ~~strikethrough~~
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // ##monospace## (Remarkup alternative)
  html = html.replace(/##(.+?)##/g, '<code class="remarkup-inline-code">$1</code>');

  // ── 9. Restore code blocks and inline code
  html = html.replace(/\x00INLINECODE_(\d+)\x00/g, (_m, idx) => inlineCodes[parseInt(idx)] || '');
  html = html.replace(/\x00CODEBLOCK_(\d+)\x00/g, (_m, idx) => codeBlocks[parseInt(idx)] || '');

  // ── 10. Wrap bare text lines in <p> tags
  // Split by block elements and wrap plain text
  html = html
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      // Don't wrap if line is already an HTML block element
      if (/^<(h[1-6]|p|div|ul|ol|li|table|thead|tbody|tr|th|td|blockquote|pre|hr|img|section|article|nav|aside|figure|figcaption)\b/i.test(trimmed)) {
        return trimmed;
      }
      // Don't wrap closing tags
      if (/^<\/(ul|ol|table|thead|tbody|blockquote|div|pre)\b/i.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .join('\n');

  // Clean up empty <p></p>
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}
