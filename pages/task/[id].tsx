import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Task } from '@/lib/api';
import { httpClient } from '@/lib/httpClient';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import AppLayout from '@/components/layout/AppLayout';

export default function TaskPage() {
  const router = useRouter();
  const { id } = router.query;
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchTask = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await httpClient<{ task: Task }>(`/api/tasks/${id}`);
        setTask(data.task);
        setIsDialogOpen(true);
      } catch (err: any) {
        setError(err.message || '加载任务失败');
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [id]);

  const handleTaskUpdate = (updatedTask: Task) => {
    setTask(updatedTask);
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <AppLayout>
      <div className="flex h-full items-center justify-center bg-muted/10">
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary/80" />
            <p className="text-sm text-muted-foreground">加载任务中...</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center">
            <p className="text-lg text-destructive mb-4">{error || '任务未找到'}</p>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              返回首页
            </button>
          </div>
        )}

        {!loading && task && (
          <TaskDetailDialog
            task={task}
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                handleBack();
              }
            }}
            onTaskUpdate={handleTaskUpdate}
          />
        )}
      </div>
    </AppLayout>
  );
}
