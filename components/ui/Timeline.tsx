import { useState, useCallback, useMemo, useEffect } from 'react';
import { Edit2, Trash2, Loader2, Check, MessageSquare, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { toastWithUndo } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RemarkupRenderer } from '@/components/ui/RemarkupRenderer';
import { RemarkupEditor } from '@/components/ui/RemarkupEditor';

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
  className?: string;
  /** localStorage key for caching draft input (e.g. 'timeline-T123'). No caching if omitted. */
  cacheKey?: string;
}

const CACHE_PREFIX = 'remarkup-draft:';

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
  className,
  cacheKey,
}: TimelineProps) {
  const [editingItemId, setEditingItemId] = useState<number | string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<number | string>>(new Set());

  // Restore cached draft on mount
  useEffect(() => {
    if (!cacheKey) return;
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + cacheKey);
      if (cached) setNewContent(cached);
    } catch { /* ignore */ }
  }, [cacheKey]);

  // Persist draft to localStorage on change
  useEffect(() => {
    if (!cacheKey) return;
    try {
      if (newContent.trim()) {
        localStorage.setItem(CACHE_PREFIX + cacheKey, newContent);
      } else {
        localStorage.removeItem(CACHE_PREFIX + cacheKey);
      }
    } catch { /* ignore */ }
  }, [newContent, cacheKey]);

  const clearDraftCache = useCallback(() => {
    if (!cacheKey) return;
    try { localStorage.removeItem(CACHE_PREFIX + cacheKey); } catch { /* ignore */ }
  }, [cacheKey]);

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
      clearDraftCache();
      // Toast is handled by the caller (onAdd callback)
    } catch (error: any) {
      toast.error(error.message || '发布失败');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Title Section */}
      <div className="flex items-center justify-between pb-2 border-b border-border/30">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {title}
        </h3>
        <span className="text-xs text-muted-foreground/60">
          {visibleItems.length} 条
        </span>
      </div>

      {/* Timeline Container */}
      <div className="space-y-8 relative">
        {/* Vertical Line */}
        {visibleItems.length > 0 && (
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/40 z-0" />
        )}

        {/* Items List */}
        <div className="space-y-8">
        {visibleItems.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/50">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="group relative flex gap-4 z-10"
              >
                <Avatar className="h-8 w-8 shrink-0 border border-border bg-background ring-4 ring-background">
                  <AvatarImage src={item.authorImage || undefined} alt={item.author} />
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-medium">
                    {item.author.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0 pt-1">
                   {/* Header: Author + Meta + Actions */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground/90">{item.author}</span>
                      <span className="text-xs text-muted-foreground/50 font-normal">{item.timestamp}</span>
                    </div>
                    
                    {showActions && (onEdit || onDelete) && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full"
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
                            className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-full"
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
                    <div className="space-y-3 animate-in fade-in zoom-in-95">
                      <RemarkupEditor
                        value={editedText}
                        onChange={setEditedText}
                        minHeight="100px"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          取消
                        </Button>
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
                              保存
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-foreground/80 leading-relaxed bg-muted/10 rounded-lg p-3 -ml-3 transition-colors group-hover:bg-muted/30">
                       <RemarkupRenderer
                        content={item.content}
                        compact
                      />
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
          <div className="pt-2 z-10 relative">
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-muted/20 border border-dashed border-border flex items-center justify-center shrink-0">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              </div>
              <div className="flex-1 space-y-3">
                <RemarkupEditor
                  value={newContent}
                  onChange={setNewContent}
                  placeholder={addPlaceholder}
                  minHeight="100px"
                  className="shadow-sm border-muted-foreground/20 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={!newContent.trim() || isAdding}
                    className="gap-2 px-4"
                  >
                    {isAdding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {isAdding ? '发布中...' : '发布评论'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
