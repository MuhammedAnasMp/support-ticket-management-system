import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  rotation?: number;
  showControls?: boolean;
  minZoom?: number;
  maxZoom?: number;
  onImageClick?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  src,
  alt = 'Image Preview',
  className = '',
  containerClassName = '',
  rotation = 0,
  showControls = true,
  minZoom = 0.5,
  maxZoom = 5,
  onImageClick,
  onError
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const initialDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);

  // Reset zoom & pan when source image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [src]);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(maxZoom, Number((prev + 0.25).toFixed(2))));
  }, [maxZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const next = Math.max(minZoom, Number((prev - 0.25).toFixed(2)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, [minZoom]);

  // Scroll wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    // Delta direction: deltaY < 0 = scroll up (zoom in), deltaY > 0 = scroll down (zoom out)
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom(prev => {
      const next = Math.min(maxZoom, Math.max(minZoom, Number((prev * factor).toFixed(2))));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, [maxZoom, minZoom]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double click toggles zoom between 1x and 2.5x
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom > 1) {
      handleReset();
    } else {
      setZoom(2.5);
    }
  };

  // Touch handlers for mobile pinch-to-zoom and drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialDistanceRef.current = dist;
      initialZoomRef.current = zoom;
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / initialDistanceRef.current;
      const next = Math.min(maxZoom, Math.max(minZoom, Number((initialZoomRef.current * scale).toFixed(2))));
      setZoom(next);
      if (next <= 1) setPan({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      setPan({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      });
    }
  };

  const handleTouchEnd = () => {
    initialDistanceRef.current = null;
    setIsDragging(false);
  };

  const cursorClass = zoom > 1
    ? isDragging
      ? 'cursor-grabbing'
      : 'cursor-grab'
    : onImageClick
      ? 'cursor-pointer'
      : 'cursor-zoom-in';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative overflow-hidden select-none flex items-center justify-center ${containerClassName}`}
    >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          transition: isDragging ? 'none' : 'transform 0.15s ease-out'
        }}
        className={`flex items-center justify-center ${cursorClass}`}
        onClick={zoom === 1 && onImageClick ? onImageClick : undefined}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onError={onError}
          className={`max-w-full max-h-full object-contain pointer-events-none ${className}`}
        />
      </div>

      {/* Floating Zoom / Pan Controls Overlay */}
      {showControls && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-2 py-1 rounded-full border border-white/20 text-white flex items-center gap-1.5 shadow-lg text-[11px] font-medium z-20 pointer-events-auto transition-opacity"
        >
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= minZoom}
            className="p-1 rounded-full hover:bg-white/20 active:scale-95 disabled:opacity-35 transition-colors cursor-pointer"
            title="Zoom Out (Scroll Down)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-1.5 py-0.5 rounded font-mono font-bold hover:bg-white/20 transition-colors cursor-pointer"
            title="Reset Zoom (Double click image)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= maxZoom}
            className="p-1 rounded-full hover:bg-white/20 active:scale-95 disabled:opacity-35 transition-colors cursor-pointer"
            title="Zoom In (Scroll Up)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1 rounded-full hover:bg-white/20 active:scale-95 text-amber-400 transition-colors cursor-pointer ml-0.5 border-l border-white/20 pl-1.5"
              title="Reset Position & Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

