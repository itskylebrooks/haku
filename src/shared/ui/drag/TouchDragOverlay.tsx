import { forwardRef, useImperativeHandle, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export interface TouchDragOverlayHandle {
  /**
   * Update the overlay position imperatively without triggering React re-renders.
   * Use this for smooth 60fps drag updates on mobile.
   */
  updatePosition: (x: number, y: number) => void;
}

interface TouchDragOverlayProps {
  children: ReactNode;
  /** Initial x position */
  initialX?: number;
  /** Initial y position */
  initialY?: number;
}

/**
 * Touch drag overlay that uses imperative position updates for smooth 60fps performance.
 * Use the ref to call updatePosition() directly instead of re-rendering the component.
 */
export const TouchDragOverlay = forwardRef<TouchDragOverlayHandle, TouchDragOverlayProps>(
  ({ children, initialX = 0, initialY = 0 }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        updatePosition: (x: number, y: number) => {
          if (containerRef.current) {
            // Direct DOM manipulation for 60fps performance - no React re-render
            containerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          }
        },
      }),
      [],
    );

    if (typeof document === 'undefined') return null;

    return createPortal(
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          transform: `translate3d(${initialX}px, ${initialY}px, 0)`,
          pointerEvents: 'none',
          zIndex: 9999,
          touchAction: 'none',
          width: 'max-content',
          // GPU acceleration hints
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
      >
        {children}
      </div>,
      document.body,
    );
  },
);

TouchDragOverlay.displayName = 'TouchDragOverlay';
