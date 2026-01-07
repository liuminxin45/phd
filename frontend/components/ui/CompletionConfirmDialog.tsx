import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

interface CompletionConfirmDialogProps {
  position: { x: number; y: number };
  onConfirm: (includeInStats: boolean) => void;
  onCancel: () => void;
  zIndex?: string;
}

export function CompletionConfirmDialog({ position, onConfirm, onCancel, zIndex = 'z-[9999]' }: CompletionConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onCancel]);

  useEffect(() => {
    if (!dialogRef.current) return;

    const dialog = dialogRef.current;
    const rect = dialog.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let { x, y } = position;
    const padding = 16; // Padding from edges

    // Adjust horizontal position
    const dialogWidth = rect.width;
    const halfWidth = dialogWidth / 2;
    
    if (x - halfWidth < padding) {
      // Too close to left edge
      x = padding + halfWidth;
    } else if (x + halfWidth > viewportWidth - padding) {
      // Too close to right edge
      x = viewportWidth - padding - halfWidth;
    }

    // Adjust vertical position
    const dialogHeight = rect.height;
    const spaceAbove = y;
    const spaceBelow = viewportHeight - y;
    
    // Default: show above cursor
    let finalY = y;
    let transformY = 'translate(-50%, -100%) translateY(-8px)';
    
    if (spaceAbove < dialogHeight + padding) {
      // Not enough space above, try below
      if (spaceBelow > dialogHeight + padding) {
        finalY = y;
        transformY = 'translate(-50%, 0%) translateY(8px)';
      } else {
        // Not enough space above or below, center vertically
        finalY = viewportHeight / 2;
        transformY = 'translate(-50%, -50%)';
      }
    }

    setAdjustedPosition({ x, y: finalY });
    dialog.style.transform = transformY;
  }, [position]);

  return (
    <div
      ref={dialogRef}
      className={`fixed ${zIndex} bg-white rounded-lg shadow-2xl border border-neutral-200 p-3 min-w-[200px]`}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        transform: 'translate(-50%, -100%) translateY(-8px)',
      }}
    >
      <div className="text-sm font-medium text-neutral-900 mb-3">标记为已完成</div>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onConfirm(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          <Check className="h-4 w-4" />
          <span>已完成</span>
        </button>
        <button
          onClick={() => onConfirm(false)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-neutral-600 text-white rounded-md hover:bg-neutral-700 transition-colors"
        >
          <Check className="h-4 w-4" />
          <span>已完成（不加入统计）</span>
        </button>
        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
        >
          <X className="h-4 w-4" />
          <span>取消</span>
        </button>
      </div>
    </div>
  );
}
