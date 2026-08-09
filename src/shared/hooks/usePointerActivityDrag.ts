import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Activity } from '../types/activity';

interface UsePointerActivityDragOptions {
  onAutoScroll: (clientY: number) => void;
  onBeginDrag?: () => void;
  leaveDelayMs?: number;
}

/** Shared pointer-drag state and drop-zone behavior for activity views. */
export const usePointerActivityDrag = ({
  onAutoScroll,
  onBeginDrag,
  leaveDelayMs = 50,
}: UsePointerActivityDragOptions) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedCardHeight, setDraggedCardHeight] = useState(72);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

  const clearLeaveTimeout = useCallback(() => {
    if (leaveTimeoutRef.current !== null) {
      window.clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  }, []);

  const beginDrag = useCallback(
    (id: string, height: number) => {
      onBeginDrag?.();
      setDraggingId(id);
      setDraggedCardHeight(height);
      setDragOverKey(null);
    },
    [onBeginDrag],
  );

  const clearDragState = useCallback(() => {
    setDraggingId(null);
    setDragOverKey(null);
    clearLeaveTimeout();
  }, [clearLeaveTimeout]);

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, activity: Activity) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', activity.id);
      beginDrag(activity.id, event.currentTarget.offsetHeight);
    },
    [beginDrag],
  );

  const handleDragOverZone = useCallback(
    (event: React.DragEvent<HTMLElement>, key: string) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      clearLeaveTimeout();
      setDragOverKey((current) => (current === key ? current : key));
      onAutoScroll(event.clientY);
    },
    [clearLeaveTimeout, onAutoScroll],
  );

  const clearDragKey = useCallback((key: string) => {
    setDragOverKey((current) => (current === key ? null : current));
  }, []);

  const handleDragLeaveZone = useCallback(
    (event: React.DragEvent<HTMLElement> | null, key: string) => {
      if (event) {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && event.currentTarget.contains(nextTarget)) return;
      }

      clearLeaveTimeout();
      leaveTimeoutRef.current = window.setTimeout(() => {
        clearDragKey(key);
        leaveTimeoutRef.current = null;
      }, leaveDelayMs);
    },
    [clearDragKey, clearLeaveTimeout, leaveDelayMs],
  );

  useEffect(() => clearLeaveTimeout, [clearLeaveTimeout]);

  return {
    draggingId,
    draggedCardHeight,
    dragOverKey,
    beginDrag,
    clearDragState,
    handleDragStart,
    handleDragOverZone,
    handleDragLeaveZone,
  };
};
