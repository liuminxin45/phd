import { useState, useCallback, useMemo } from 'react';
import { Edit2, Trash2, Loader2, Check, MessageSquare, Download, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { toastWithUndo } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';

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
  className?: string;
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
            className="inline-block max-w-[120px] h-auto rounded-md border shadow-sm my-1 cursor-zoom-in hover:opacity-90 transition-opacity"
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
            className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 hover:underline cursor-pointer mx-1 font-medium"
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
            <Download className="h-3.5 w-3.5" />
            <span>{metadata.name || `F${fileId}`}</span>
          </a>
        );
      }
    } else {
      // File not loaded, show placeholder
      parts.push(
        <span key={`file-${fileId}-${match.index}`} className="text-muted-foreground mx-1 text-xs bg-muted px-1 py-0.5 rounded">
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
  className,
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
    <div className={cn("space-y-4", className)}>
      {/* Title Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">
          {visibleItems.length} 条{title.includes('评论') ? '评论' : '动态'}
        </span>
      </div>

      {/* Timeline Container */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 shadow-sm">
        {/* Items List */}
        <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4">
        {visibleItems.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="group relative flex gap-3"
              >
                <Avatar className="h-8 w-8 shrink-0 border">
                  <AvatarImage src={item.authorImage || undefined} alt={item.author} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {item.author.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                   {/* Header: Author + Meta + Actions */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.author}</span>
                      <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                    </div>
                    
                    {showActions && (onEdit || onDelete) && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => handleEditClick(item)}
                            title="编辑"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(item)}
                            disabled={isDeleting === item.id}
                            title="删除"
                          >
                            {isDeleting === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Content or Edit Form */}
                  {editingItemId === item.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="min-h-[80px] text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(item)}
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              保存中
                            </>
                          ) : (
                            <>
                              <Check className="mr-2 h-3 w-3" />
                              保存
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words bg-background border border-border/50 rounded-md p-3 shadow-sm">
                      {processTextWithFiles(item.content, fileCache, fileMetadata, onImagePreview)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Add New Input */}
        {showAddInput && onAdd && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={addPlaceholder}
              className="min-h-[80px] text-sm resize-none"
              disabled={isAdding}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newContent.trim() || isAdding}
                className="gap-2"
              >
                {isAdding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isAdding ? '发布中...' : '发布'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
