import type React from "react";
import { useRef, useCallback } from "react";

interface TouchDragConfig<T> {
  onDragStart?: (item: T, element: HTMLElement) => void;
  onDragMove?: (item: T, clientY: number, element: HTMLElement) => void;
  onDragEnd?: (item: T, element: HTMLElement) => void;
  onDragCancel?: () => void;
  longPressDelay?: number;
}

interface TouchDragHandlers {
  onTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLElement>) => void;
}

/**
 * Hook for touch-based drag and drop on mobile devices.
 * Uses a long-press to initiate drag to distinguish from scrolling.
 */
export function useTouchDrag<T>(
  item: T,
  config: TouchDragConfig<T>
): TouchDragHandlers {
  const {
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    longPressDelay = 150,
  } = config;

  const longPressTimerRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      isDraggingRef.current = false;

      clearLongPressTimer();

      longPressTimerRef.current = window.setTimeout(() => {
        isDraggingRef.current = true;
        const element = event.currentTarget;
        onDragStart?.(item, element);
        // Prevent scrolling once drag starts
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
      }, longPressDelay);
    },
    [item, onDragStart, longPressDelay, clearLongPressTimer]
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];

      // If we haven't started dragging yet, check if we've moved too much
      if (!isDraggingRef.current) {
        const deltaX = Math.abs(touch.clientX - startXRef.current);
        const deltaY = Math.abs(touch.clientY - startYRef.current);

        // If moved more than threshold before long press, cancel
        if (deltaX > 10 || deltaY > 10) {
          clearLongPressTimer();
          onDragCancel?.();
        }
        return;
      }

      // We're dragging
      event.preventDefault();
      onDragMove?.(item, touch.clientY, event.currentTarget);
    },
    [item, onDragMove, clearLongPressTimer, onDragCancel]
  );

  const onTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      clearLongPressTimer();

      if (isDraggingRef.current) {
        event.preventDefault();
        onDragEnd?.(item, event.currentTarget);
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      }

      isDraggingRef.current = false;
    },
    [item, onDragEnd, clearLongPressTimer]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
