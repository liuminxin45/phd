/**
 * Parse Phabricator Remarkup syntax and convert to Markdown
 * Handles file references like {F123, size=full}
 */

interface FileReference {
  fileId: string;
  options: Record<string, string>;
  originalText: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Extract file references from Remarkup text
 * Pattern: {F123} or {F123, size=full, layout=center}
 */
export function extractFileReferences(text: string): FileReference[] {
  const filePattern = /\{F(\d+)(?:,\s*([^}]+))?\}/g;
  const references: FileReference[] = [];
  let match;

  while ((match = filePattern.exec(text)) !== null) {
    const fileId = match[1];
    const optionsStr = match[2] || '';
    const options: Record<string, string> = {};

    // Parse options like "size=full, layout=center"
    if (optionsStr) {
      const optionPairs = optionsStr.split(',').map(s => s.trim());
      for (const pair of optionPairs) {
        const [key, value] = pair.split('=').map(s => s.trim());
        if (key && value) {
          options[key] = value;
        }
      }
    }

    references.push({
      fileId,
      options,
      originalText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return references;
}

/**
 * Convert file reference to image markdown
 */
export function fileReferenceToMarkdown(
  fileId: string,
  options: Record<string, string>,
  fileDataURI?: string
): string {
  const size = options.size || 'thumb';
  const layout = options.layout || 'left';
  const alt = options.alt || `File F${fileId}`;
  
  // If we have the dataURI, use it directly
  if (fileDataURI) {
    // For inline layout, just show the image
    if (layout === 'inline' || layout === 'link') {
      return `![${alt}](${fileDataURI})`;
    }
    
    // For other layouts, wrap in a div with alignment
    const alignClass = layout === 'center' ? 'center' : layout === 'right' ? 'right' : 'left';
    return `<div style="text-align: ${alignClass}">![${alt}](${fileDataURI})</div>`;
  }
  
  // Fallback: show a placeholder with file ID
  return `[Image F${fileId}]`;
}

/**
 * Replace file references in text with markdown images
 */
export async function replaceFileReferences(
  text: string,
  fileDataCache?: Record<string, string>
): Promise<string> {
  const references = extractFileReferences(text);
  
  if (references.length === 0) {
    return text;
  }

  let result = text;
  
  // Replace from end to start to maintain correct indices
  for (let i = references.length - 1; i >= 0; i--) {
    const ref = references[i];
    const fileDataURI = fileDataCache?.[ref.fileId];
    const markdown = fileReferenceToMarkdown(ref.fileId, ref.options, fileDataURI);
    
    result = result.substring(0, ref.startIndex) + markdown + result.substring(ref.endIndex);
  }

  return result;
}

/**
 * Get all file IDs from text
 */
export function getFileIdsFromText(text: string): string[] {
  const references = extractFileReferences(text);
  return references.map(ref => ref.fileId);
}
