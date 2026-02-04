import { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImagePreview({ src, alt = 'Image', isOpen, onClose }: ImagePreviewProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(0.1, Math.min(5, prev + delta)));
  };

  // Handle mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === imageRef.current) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom controls
  const zoomIn = () => setScale((prev) => Math.min(5, prev + 0.2));
  const zoomOut = () => setScale((prev) => Math.max(0.1, prev - 0.2));
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };
  const rotate = () => setRotation((prev) => (prev + 90) % 360);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[20000] bg-black/90 flex items-center justify-center"
      onClick={(e) => {
        // Close when clicking on backdrop (not on image or controls)
        if (e.target === containerRef.current) {
          onClose();
        }
      }}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Control Bar */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 rounded-lg p-2 backdrop-blur-sm">
        <button
          onClick={zoomOut}
          className="p-2 text-white hover:bg-white/20 rounded-md transition-colors"
          title="缩小 (滚轮向下)"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <span className="text-white text-sm font-mono min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="p-2 text-white hover:bg-white/20 rounded-md transition-colors"
          title="放大 (滚轮向上)"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <div className="w-px h-6 bg-white/30 mx-1" />
        <button
          onClick={rotate}
          className="p-2 text-white hover:bg-white/20 rounded-md transition-colors"
          title="旋转 90°"
        >
          <RotateCw className="h-5 w-5" />
        </button>
        <button
          onClick={resetZoom}
          className="p-2 text-white hover:bg-white/20 rounded-md transition-colors"
          title="重置"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
        <div className="w-px h-6 bg-white/30 mx-1" />
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/20 rounded-md transition-colors"
          title="关闭 (ESC)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image */}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain select-none"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
        onMouseDown={handleMouseDown}
        draggable={false}
      />

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 rounded-lg px-4 py-2 backdrop-blur-sm">
        <p className="text-white text-sm text-center">
          滚轮缩放 · 拖拽移动 · ESC 或点击外部关闭
        </p>
      </div>
    </div>
  );
}
