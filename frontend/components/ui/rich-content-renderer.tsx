import { FileText, Download, ExternalLink as ExternalLinkIcon } from 'lucide-react';

interface RichContentRendererProps {
  content: string;
}

interface ParsedContent {
  type: 'text' | 'image' | 'attachment' | 'link';
  content: string;
  url?: string;
  filename?: string;
}

export function RichContentRenderer({ content }: RichContentRendererProps) {
  const openExternal = (url?: string) => {
    if (!url) return;
    if (typeof window !== 'undefined' && window.phabdash?.openExternal) {
      void window.phabdash.openExternal(url);
      return;
    }
    window.open(url, '_blank');
  };

  // Parse content to extract images, attachments, and links
  const parseContent = (text: string): ParsedContent[] => {
    const parts: ParsedContent[] = [];
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      // Match image pattern: ![alt](url) or [image:url]
      const imageRegex = /!\[.*?\]\((.*?)\)|\[image:(.*?)\]/g;
      // Match attachment pattern: [file:filename:url]
      const attachmentRegex = /\[file:(.*?):(.*?)\]/g;
      // Match link pattern: [text](url) or http(s)://...
      const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|(https?:\/\/[^\s]+)/g;
      
      let lastIndex = 0;
      let match;
      
      // Extract images
      while ((match = imageRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', content: line.slice(lastIndex, match.index) });
        }
        parts.push({ type: 'image', content: '', url: match[1] || match[2] });
        lastIndex = imageRegex.lastIndex;
      }
      
      // Reset regex
      imageRegex.lastIndex = 0;
      
      // Extract attachments
      const tempLine = line;
      lastIndex = 0;
      while ((match = attachmentRegex.exec(tempLine)) !== null) {
        if (match.index > lastIndex) {
          const textPart = tempLine.slice(lastIndex, match.index);
          if (textPart && !imageRegex.test(textPart)) {
            parts.push({ type: 'text', content: textPart });
          }
        }
        parts.push({ 
          type: 'attachment', 
          content: match[1],
          filename: match[1],
          url: match[2]
        });
        lastIndex = attachmentRegex.lastIndex;
      }
      
      // Reset regex
      attachmentRegex.lastIndex = 0;
      
      // Extract links
      const cleanLine = line.replace(imageRegex, '').replace(attachmentRegex, '');
      lastIndex = 0;
      let foundLink = false;
      
      while ((match = linkRegex.exec(cleanLine)) !== null) {
        foundLink = true;
        if (match.index > lastIndex) {
          parts.push({ type: 'text', content: cleanLine.slice(lastIndex, match.index) });
        }
        parts.push({ 
          type: 'link', 
          content: match[1] || match[2] || match[3],
          url: match[2] || match[3]
        });
        lastIndex = linkRegex.lastIndex;
      }
      
      // Add remaining text
      if (lastIndex < line.length && !imageRegex.test(line) && !attachmentRegex.test(line)) {
        const remaining = line.slice(lastIndex);
        if (remaining.trim()) {
          parts.push({ type: 'text', content: remaining });
        }
      } else if (parts.length === 0 || (parts[parts.length - 1]?.type !== 'text' && line.trim())) {
        // If no special content found and line has text
        if (!imageRegex.test(line) && !attachmentRegex.test(line) && !linkRegex.test(line)) {
          parts.push({ type: 'text', content: line });
        }
      }
      
      // Add line break after each line except the last
      if (lineIndex < lines.length - 1) {
        if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
          parts[parts.length - 1].content += '\n';
        } else {
          parts.push({ type: 'text', content: '\n' });
        }
      }
    });
    
    return parts;
  };

  const parts = parseContent(content);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        switch (part.type) {
          case 'image':
            return (
              <div key={index} className="inline-block">
                <img
                  src={part.url}
                  alt="content"
                  className="rounded border border-neutral-200 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ width: '80px', height: 'auto' }}
                  onClick={() => openExternal(part.url)}
                />
              </div>
            );
          
          case 'attachment':
            return (
              <a
                key={index}
                href={part.url}
                download={part.filename}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 transition-colors text-xs text-neutral-700 mr-2"
              >
                <FileText className="h-3 w-3" />
                <span>{part.filename}</span>
                <Download className="h-3 w-3" />
              </a>
            );
          
          case 'link':
            return (
              <a
                key={index}
                href={part.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
                onClick={(e) => {
                  if (typeof window !== 'undefined' && window.phabdash?.openExternal && part.url) {
                    e.preventDefault();
                    openExternal(part.url);
                  }
                }}
              >
                {part.content}
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
            );
          
          case 'text':
          default:
            return (
              <span key={index} className="whitespace-pre-wrap break-words">
                {part.content}
              </span>
            );
        }
      })}
    </div>
  );
}
