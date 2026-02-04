import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Task } from '@/lib/api';
import { httpClient } from '@/lib/httpClient';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';

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
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-neutral-600">加载任务中...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">{error || '任务未找到'}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
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
    </>
  );
}
