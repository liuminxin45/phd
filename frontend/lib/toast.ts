import { toast as sonnerToast } from 'sonner';

export const toast = {
  success: (message: string) => {
    sonnerToast.success(message);
  },
  error: (message: string) => {
    sonnerToast.error(message);
  },
  info: (message: string) => {
    sonnerToast.info(message);
  },
  warning: (message: string) => {
    sonnerToast.warning(message);
  },
};

export function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  toast[type](message);
}

interface UndoableToastOptions {
  message: string;
  duration?: number;
  onConfirm: () => Promise<void> | void;
  onUndo?: () => void;
  undoLabel?: string;
}

export function toastWithUndo({
  message,
  duration = 5000,
  onConfirm,
  onUndo,
  undoLabel = '撤销',
}: UndoableToastOptions): void {
  let isUndone = false;
  let isConfirmed = false;

  const executeConfirm = () => {
    if (!isUndone && !isConfirmed) {
      isConfirmed = true;
      onConfirm();
    }
  };

  const handleUndo = () => {
    isUndone = true;
    if (onUndo) {
      onUndo();
    }
  };

  const toastId = sonnerToast(message, {
    duration,
    action: {
      label: undoLabel,
      onClick: (event) => {
        handleUndo();
      },
    },
    onAutoClose: () => {
      executeConfirm();
    },
    onDismiss: (t) => {
      if (!isUndone) {
        executeConfirm();
      }
    },
  });

  void toastId;
}
