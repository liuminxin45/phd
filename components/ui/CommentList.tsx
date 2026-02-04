import { useState } from 'react';
import { Edit2, Trash2, Loader2, Check, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export interface Comment {
  id: number | string;
  author: string;
  content: string;
  timestamp: string;
  authorPHID?: string;
}

interface CommentListProps {
  comments: Comment[];
  onEdit?: (commentId: number | string, newContent: string) => Promise<void>;
  onDelete?: (commentId: number | string) => Promise<void>;
  emptyMessage?: string;
  className?: string;
  showActions?: boolean;
}

export function CommentList({
  comments,
  onEdit,
  onDelete,
  emptyMessage = '暂无评论',
  className = '',
  showActions = true,
}: CommentListProps) {
  const [editingCommentId, setEditingCommentId] = useState<number | string | null>(null);
  const [editedCommentText, setEditedCommentText] = useState('');
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState<number | string | null>(null);

  const handleEditClick = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditedCommentText(comment.content);
  };

  const handleSaveEdit = async (comment: Comment) => {
    const trimmedText = editedCommentText.trim();
    
    if (!trimmedText) {
      toast.error('评论内容不能为空');
      return;
    }
    
    if (trimmedText === comment.content.trim()) {
      setEditingCommentId(null);
      setEditedCommentText('');
      return;
    }
    
    if (!onEdit) return;
    
    setIsUpdatingComment(true);
    try {
      await onEdit(comment.id, trimmedText);
      setEditingCommentId(null);
      setEditedCommentText('');
      toast.success('评论已更新');
    } catch (error: any) {
      toast.error(error.message || '更新评论失败');
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditedCommentText('');
  };

  const handleDelete = async (comment: Comment) => {
    if (!window.confirm('确定要删除这条评论吗？此操作将同步到 Phabricator。')) {
      return;
    }
    
    if (!onDelete) return;
    
    setIsDeletingComment(comment.id);
    try {
      await onDelete(comment.id);
      toast.success('评论已删除');
    } catch (error: any) {
      toast.error(error.message || '删除评论失败');
    } finally {
      setIsDeletingComment(null);
    }
  };

  if (comments.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <MessageSquare className="h-12 w-12 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="bg-white border border-neutral-200 rounded-lg p-3 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                {comment.author.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-neutral-900">{comment.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">{comment.timestamp}</span>
              {showActions && (onEdit || onDelete) && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEdit && (
                    <button
                      onClick={() => handleEditClick(comment)}
                      className="p-1 hover:bg-blue-100 rounded transition-all"
                      title="编辑评论"
                    >
                      <Edit2 className="h-3 w-3 text-blue-500" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => handleDelete(comment)}
                      disabled={isDeletingComment === comment.id}
                      className="p-1 hover:bg-red-100 rounded transition-all disabled:opacity-50"
                      title="删除评论"
                    >
                      {isDeletingComment === comment.id ? (
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
          {editingCommentId === comment.id ? (
            <div className="pl-8 space-y-2">
              <textarea
                value={editedCommentText}
                onChange={(e) => setEditedCommentText(e.target.value)}
                className="w-full text-xs text-neutral-700 bg-white border border-blue-300 rounded-lg p-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveEdit(comment)}
                  disabled={isUpdatingComment}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {isUpdatingComment ? (
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
            <p className="text-xs text-neutral-700 leading-relaxed pl-8 whitespace-pre-wrap">{comment.content}</p>
          )}
        </div>
      ))}
    </div>
  );
}
