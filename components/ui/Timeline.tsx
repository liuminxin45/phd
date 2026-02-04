import { useState, useCallback, useMemo } from 'react';
import { Edit2, Trash2, Loader2, Check, MessageSquare, Download, Send } from 'lucide-react';
import { toast } from 'sonner';
import { toastWithUndo } from '@/lib/toast';

export interface TimelineItem {
  id: number | string;
  author: string;
  authorPHID?: string;
  authorImage?: string | null;
  content: string;
  timestamp: string;
  dateCreated?: number;
}

interface TimelineProps {
  title: string;
  items: TimelineItem[];
  onEdit?: (itemId: number | string, newContent: string) => Promise<void>;
  onDelete?: (itemId: number | string) => Promise<void>;
  onAdd?: (content: string) => Promise<void>;
  emptyMessage?: string;
  addPlaceholder?: string;
  showActions?: boolean;
  showAddInput?: boolean;
  fileCache?: Record<string, string>;
  fileMetadata?: Record<string, any>;
  onImagePreview?: (src: string, alt: string) => void;
}

// Process text to replace file references with inline display
function processTextWithFiles(
  text: string, 
  fileCache: Record<string, string>, 
  fileMetadata: Record<string, any>,
  onImagePreview?: (src: string, alt: string) => void
): React.ReactNode[] {
  const filePattern = /\{F(\d+)(?:[^}]*)?\}/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = filePattern.exec(text)) !== null) {
    // Add text before the file reference
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const fileId = match[1];
    const dataURI = fileCache[fileId];
    const metadata = fileMetadata[fileId];

    if (dataURI && metadata) {
      const isImage = metadata.mimeType?.startsWith('image/');
      
      if (isImage) {
        // Render image thumbnail
        parts.push(
          <img
            key={`file-${fileId}-${match.index}`}
            src={dataURI}
            alt={metadata.name || `F${fileId}`}
            className="inline-block max-w-[80px] h-auto rounded-lg shadow-sm my-1 cursor-zoom-in hover:opacity-90 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              if (onImagePreview) {
                onImagePreview(metadata.url || dataURI, metadata.name || `F${fileId}`);
              }
            }}
          />
        );
      } else {
        // Render file download link
        parts.push(
          <a
            key={`file-${fileId}-${match.index}`}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer mx-1"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              try {
                const downloadSrc = metadata.url || dataURI;
                if (!downloadSrc) {
                  throw new Error('文件未正确加载');
                }

                if (downloadSrc.startsWith('data:')) {
                  const response = await fetch(downloadSrc);
                  const blob = await response.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = blobUrl;
                  link.download = metadata.name || `F${fileId}`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(blobUrl);
                } else {
                  if (window.phabdash?.openExternal) {
                    await window.phabdash.openExternal(downloadSrc);
                  } else {
                    window.open(downloadSrc, '_blank');
                  }
                }
              } catch (error) {
                toast.error('下载文件失败');
              }
            }}
          >
            <Download className="h-3 w-3" />
            <span>{metadata.name || `F${fileId}`}</span>
          </a>
        );
      }
    } else {
      // File not loaded, show placeholder
      parts.push(
        <span key={`file-${fileId}-${match.index}`} className="text-neutral-400 mx-1">
          {match[0]}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function Timeline({
  title,
  items,
  onEdit,
  onDelete,
  onAdd,
  emptyMessage = '暂无内容',
  addPlaceholder = '分享项目进展、想法或更新...',
  showActions = true,
  showAddInput = true,
  fileCache = {},
  fileMetadata = {},
  onImagePreview,
}: TimelineProps) {
  const [editingItemId, setEditingItemId] = useState<number | string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<number | string>>(new Set());

  // Filter out pending delete items
  const visibleItems = useMemo(() => 
    items.filter(item => !pendingDeleteIds.has(item.id)),
    [items, pendingDeleteIds]
  );

  const handleEditClick = (item: TimelineItem) => {
    setEditingItemId(item.id);
    setEditedText(item.content);
  };

  const handleSaveEdit = async (item: TimelineItem) => {
    const trimmedText = editedText.trim();
    
    if (!trimmedText) {
      toast.error('内容不能为空');
      return;
    }
    
    if (trimmedText === item.content.trim()) {
      setEditingItemId(null);
      setEditedText('');
      return;
    }
    
    if (!onEdit) return;
    
    setIsUpdating(true);
    try {
      await onEdit(item.id, trimmedText);
      setEditingItemId(null);
      setEditedText('');
      // Toast is handled by the caller (onEdit callback)
    } catch (error: any) {
      toast.error(error.message || '更新失败');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditedText('');
  };

  const handleDelete = useCallback((item: TimelineItem) => {
    if (!onDelete) return;
    
    // Immediately hide the item in UI
    setPendingDeleteIds(prev => new Set(prev).add(item.id));
    
    // Show toast with undo option
    toastWithUndo({
      message: '内容已删除',
      duration: 5000,
      onConfirm: async () => {
        // User didn't undo, actually delete
        setIsDeleting(item.id);
        try {
          await onDelete(item.id);
        } catch (error: any) {
          // Restore item if delete failed
          setPendingDeleteIds(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
          toast.error(error.message || '删除失败');
        } finally {
          setIsDeleting(null);
        }
      },
      onUndo: () => {
        // Restore item in UI
        setPendingDeleteIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      },
    });
  }, [onDelete]);

  const handleAdd = async () => {
    const trimmedContent = newContent.trim();
    
    if (!trimmedContent) {
      toast.error('内容不能为空');
      return;
    }
    
    if (!onAdd) return;
    
    setIsAdding(true);
    try {
      await onAdd(trimmedContent);
      setNewContent('');
      // Toast is handled by the caller (onAdd callback)
    } catch (error: any) {
      toast.error(error.message || '发布失败');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Title Section */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {title}
        </h3>
        <span className="text-xs text-neutral-500">
          {visibleItems.length} 条{title.includes('评论') ? '评论' : '动态'}
        </span>
      </div>

      {/* Timeline Container */}
      <div className="bg-gradient-to-br from-blue-50 to-neutral-50 border border-blue-200 rounded-lg p-4 shadow-sm">
        {/* Items List */}
        <div className="mb-4 max-h-80 overflow-y-auto pr-1">
        {visibleItems.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-2">
      {visibleItems.map((item) => (
        <div
          key={item.id}
          className="bg-white border border-neutral-200 rounded-lg p-3 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {item.authorImage ? (
                <img
                  src={item.authorImage}
                  alt={item.author}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                  {item.author.charAt(0)}
                </div>
              )}
              <span className="text-xs font-semibold text-neutral-900">{item.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">{item.timestamp}</span>
              {showActions && (onEdit || onDelete) && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEdit && (
                    <button
                      onClick={() => handleEditClick(item)}
                      className="p-1 hover:bg-blue-100 rounded transition-all"
                      title="编辑"
                    >
                      <Edit2 className="h-3 w-3 text-blue-500" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={isDeleting === item.id}
                      className="p-1 hover:bg-red-100 rounded transition-all disabled:opacity-50"
                      title="删除"
                    >
                      {isDeleting === item.id ? (
                        <Loader2 className="h-3 w-3 text-red-500 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-red-500" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {editingItemId === item.id ? (
            <div className="pl-8 space-y-2">
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full text-xs text-neutral-700 bg-white border border-blue-300 rounded-lg p-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveEdit(item)}
                  disabled={isUpdating}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      保存
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 text-neutral-600 text-xs hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-neutral-700 leading-relaxed pl-8 whitespace-pre-wrap break-words">
              {processTextWithFiles(item.content, fileCache, fileMetadata, onImagePreview)}
            </div>
          )}
        </div>
      ))}
          </div>
        )}
      </div>

      {/* Add New Input */}
      {showAddInput && onAdd && (
        <div className="space-y-2 pt-3 border-t border-blue-200">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={addPlaceholder}
            className="w-full text-sm px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 resize-none transition-all"
            rows={3}
            disabled={isAdding}
          />
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={!newContent.trim() || isAdding}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${
                newContent.trim() && !isAdding
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              {isAdding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {isAdding ? '发布中...' : '发布动态'}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
