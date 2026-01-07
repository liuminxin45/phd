import { useState } from 'react';
import { httpClient } from '@/lib/httpClient';

interface TaskEditTransaction {
  type: string;
  value: any;
}

interface UseTaskEditOptions {
  taskId: number;
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

export function useTaskEdit({ taskId, onSuccess, onError }: UseTaskEditOptions) {
  const [isLoading, setIsLoading] = useState(false);

  const editTask = async (transactions: TaskEditTransaction[]) => {
    setIsLoading(true);
    try {
      await httpClient('/api/tasks/edit', {
        method: 'POST',
        body: {
          objectIdentifier: `T${taskId}`,
          transactions,
        },
      });

      onSuccess?.();
      return { success: true };
    } catch (error) {
      onError?.(error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const addSubscriber = async (phid: string) => {
    return editTask([{ type: 'subscribers.add', value: [phid] }]);
  };

  const removeSubscriber = async (phid: string) => {
    return editTask([{ type: 'subscribers.remove', value: [phid] }]);
  };

  const addProject = async (phid: string) => {
    return editTask([{ type: 'projects.add', value: [phid] }]);
  };

  const removeProject = async (phid: string) => {
    return editTask([{ type: 'projects.remove', value: [phid] }]);
  };

  const assignTask = async (phid: string) => {
    return editTask([{ type: 'owner', value: phid }]);
  };

  const unassignTask = async () => {
    return editTask([{ type: 'owner', value: '' }]);
  };

  return {
    isLoading,
    editTask,
    addSubscriber,
    removeSubscriber,
    addProject,
    removeProject,
    assignTask,
    unassignTask,
  };
}
