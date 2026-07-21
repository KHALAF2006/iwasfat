import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { showApiError } from '@/lib/api-error';

export default function CommentSection({ postId, subscriber }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Subscribe to real-time updates
    const unsubscribe = base44.entities.GroupComment.subscribe((event) => {
      if (event.type === 'create' && event.data.post_id === postId) {
        setComments(prev => [event.data, ...prev]);
      }
    });

    // Initial load
    loadComments();
    return unsubscribe;
  }, [postId]);

  const loadComments = async () => {
    try {
      const data = await base44.entities.GroupComment.filter(
        { post_id: postId },
        '-created_date',
        50
      );
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !subscriber) return;

    setLoading(true);
    try {
      await base44.entities.GroupComment.create({
        post_id: postId,
        subscriber_id: subscriber.id,
        subscriber_name: subscriber.full_name,
        content: newComment
      });
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      showApiError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-input space-y-4">
      <div>
        <h4 className="font-semibold mb-4">التعليقات ({comments.length})</h4>

        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-secondary p-3 rounded-md">
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium text-sm">{comment.subscriber_name}</div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_date), { locale: ar, addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-foreground">{comment.content}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <Textarea
            placeholder="أضف تعليقك..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="resize-none h-24"
          />
          <Button
            onClick={handleAddComment}
            disabled={!newComment.trim() || loading}
            className="w-full"
          >
            {loading ? 'جاري الإضافة...' : 'إضافة تعليق'}
          </Button>
        </div>
      </div>
    </div>
  );
}