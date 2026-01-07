import React from 'react';
import { renderMarkdown } from '@/lib/markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Fast markdown renderer using marked library
 * Much faster than ReactMarkdown for large content
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '',
  onClick 
}) => {
  const html = renderMarkdown(content);
  
  return (
    <div 
      className={className}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
