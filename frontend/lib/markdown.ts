import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for better performance
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Fast markdown renderer using marked + DOMPurify
 * Much faster than ReactMarkdown for large content
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  try {
    const html = marked.parse(markdown);
    return DOMPurify.sanitize(html as string);
  } catch (error) {
    console.error('Markdown rendering error:', error);
    return DOMPurify.sanitize(markdown);
  }
}
