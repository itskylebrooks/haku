import { useCallback, useEffect, useRef } from "react";
import type { RefObject, TouchEvent as ReactTouchEvent } from "react";
import type { TouchDragOverlayHandle } from "@/shared/ui/drag";

type Point = { x: number; y: number };

interface TouchDragScrollLock {
  getScrollContainer?: () => HTMLElement | Window | null;
  getFallbackElement?: () => HTMLElement | null;
}

export interface TouchDragStartContext<TMeta> {
  id: string;
  meta: TMeta;
  element: HTMLElement;
  rect: DOMRect;
}

export interface TouchDragMoveContext<TMeta> {
  id: string;
  meta: TMeta;
  clientX: number;
  clientY: number;
}

export interface TouchDragEndContext<TMeta> {
  id: string;
  meta: TMeta;
  cancelled: boolean;
}

interface UseTouchDragAndDropOptions<TMeta> {
  enabled: boolean;
  overlayRef: RefObject<TouchDragOverlayHandle | null>;
  scrollLock?: TouchDragScrollLock;
  longPressMs?: number;
  startMoveTolerancePx?: number;
  onDragStart: (ctx: TouchDragStartContext<TMeta>) => void;
  onDragMove: (ctx: TouchDragMoveContext<TMeta>) => void;
  onDragEnd: (ctx: TouchDragEndContext<TMeta>) => void;
}

type PendingDrag<TMeta> = {
  id: string;
  meta: TMeta;
  touchId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  element: HTMLElement;
  rect: DOMRect;
};

type ActiveDrag<TMeta> = PendingDrag<TMeta> & {
  initialPosition: Point;
};

const findTouchById = (event: TouchEvent, touchId: number): Touch | null => {
  for (let i = 0; i < event.touches.length; i += 1) {
    const touch = event.touches.item(i);
    if (touch && touch.identifier === touchId) return touch;
  }
  for (let i = 0; i < event.changedTouches.length; i += 1) {
    const touch = event.changedTouches.item(i);
    if (touch && touch.identifier === touchId) return touch;
  }
  return null;
};

export function useTouchDragAndDrop<TMeta>({
  enabled,
  overlayRef,
  scrollLock,
  longPressMs = 150,
  startMoveTolerancePx = 10,
  onDragStart,
  onDragMove,
  onDragEnd,
}: UseTouchDragAndDropOptions<TMeta>) {
  const longPressTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<PendingDrag<TMeta> | null>(null);
  const activeRef = useRef<ActiveDrag<TMeta> | null>(null);
  const initialPositionRef = useRef<Point>({ x: 0, y: 0 });

  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => {
    onDragStartRef.current = onDragStart;
    onDragMoveRef.current = onDragMove;
    onDragEndRef.current = onDragEnd;
  }, [onDragStart, onDragMove, onDragEnd]);

  const scrollLockCleanupRef = useRef<(() => void) | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const cleanupGlobalListenersRef = useRef<(() => void) | null>(null);

  const unlockScroll = useCallback(() => {
    if (scrollLockCleanupRef.current) {
      scrollLockCleanupRef.current();
      scrollLockCleanupRef.current = null;
    }
    document.body.style.overscrollBehavior = "";
  }, []);

  const endDrag = useCallback((cancelled: boolean) => {
    const active = activeRef.current;
    if (!active) return;

    activeRef.current = null;
    pendingRef.current = null;
    clearLongPressTimer();

    if (cleanupGlobalListenersRef.current) {
      cleanupGlobalListenersRef.current();
      cleanupGlobalListenersRef.current = null;
    }

    unlockScroll();
    onDragEndRef.current({ id: active.id, meta: active.meta, cancelled });
  }, [clearLongPressTimer, unlockScroll]);

  const lockScroll = useCallback(() => {
    document.body.style.overscrollBehavior = "none";

    const container = scrollLock?.getScrollContainer?.() ?? null;
    const fallback = scrollLock?.getFallbackElement?.() ?? null;

    const applyLock = (element: HTMLElement) => {
      const prev = {
        overflow: element.style.overflow,
        touchAction: element.style.touchAction,
        overscrollBehavior: element.style.overscrollBehavior,
      };
      element.style.overflow = "hidden";
      element.style.touchAction = "none";
      element.style.overscrollBehavior = "none";
      return () => {
        element.style.overflow = prev.overflow;
        element.style.touchAction = prev.touchAction;
        element.style.overscrollBehavior = prev.overscrollBehavior;
      };
    };

    if (container && container instanceof HTMLElement) {
      scrollLockCleanupRef.current = applyLock(container);
      return;
    }
    if (fallback) {
      scrollLockCleanupRef.current = applyLock(fallback);
      return;
    }

    const prevBody = {
      overflow: document.body.style.overflow,
      touchAction: document.body.style.touchAction,
    };
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    scrollLockCleanupRef.current = () => {
      document.body.style.overflow = prevBody.overflow;
      document.body.style.touchAction = prevBody.touchAction;
    };
  }, [scrollLock]);

  const startDragFromPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (!enabled) {
      pendingRef.current = null;
      return;
    }
    if (!document.contains(pending.element)) {
      pendingRef.current = null;
      return;
    }

    const initialX = pending.startX - pending.offsetX;
    const initialY = pending.startY - pending.offsetY;
    const initialPosition = { x: initialX, y: initialY };

    const active: ActiveDrag<TMeta> = {
      ...pending,
      initialPosition,
    };
    activeRef.current = active;
    initialPositionRef.current = initialPosition;

    lockScroll();

    const onDocTouchMove = (event: TouchEvent) => {
      const current = activeRef.current;
      if (!current) return;
      const touch = findTouchById(event, current.touchId);
      if (!touch) return;
      event.preventDefault();

      overlayRef.current?.updatePosition(
        touch.clientX - current.offsetX,
        touch.clientY - current.offsetY
      );
      onDragMoveRef.current({
        id: current.id,
        meta: current.meta,
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
    };

    const onDocTouchEndOrCancel = (event: TouchEvent) => {
      const current = activeRef.current;
      if (!current) return;
      const touch = findTouchById(event, current.touchId);
      if (!touch) return;
      event.preventDefault();
      const isCancel = event.type === "touchcancel";
      endDrag(isCancel);
    };

    document.addEventListener("touchmove", onDocTouchMove, { passive: false });
    document.addEventListener("touchend", onDocTouchEndOrCancel, { passive: false });
    document.addEventListener("touchcancel", onDocTouchEndOrCancel, { passive: false });

    cleanupGlobalListenersRef.current = () => {
      document.removeEventListener("touchmove", onDocTouchMove);
      document.removeEventListener("touchend", onDocTouchEndOrCancel);
      document.removeEventListener("touchcancel", onDocTouchEndOrCancel);
    };

    onDragStartRef.current({
      id: active.id,
      meta: active.meta,
      element: active.element,
      rect: active.rect,
    });
  }, [enabled, endDrag, lockScroll, overlayRef]);

  const cancel = useCallback(() => {
    clearLongPressTimer();
    pendingRef.current = null;
    endDrag(true);
  }, [clearLongPressTimer, endDrag]);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  const getTouchStartProps = useCallback(
    (id: string, meta: TMeta) => {
      return {
        onTouchStart: (event: ReactTouchEvent<HTMLElement>) => {
          if (!enabled) return;
          const touch = event.touches[0];
          if (!touch) return;
          if (activeRef.current) return;

          const element = event.currentTarget as HTMLElement;
          const rect = element.getBoundingClientRect();
          const offsetX = touch.clientX - rect.left;
          const offsetY = touch.clientY - rect.top;

          pendingRef.current = {
            id,
            meta,
            touchId: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            offsetX,
            offsetY,
            element,
            rect,
          };

          clearLongPressTimer();
          longPressTimerRef.current = window.setTimeout(() => {
            startDragFromPending();
          }, longPressMs);
        },
      };
    },
    [clearLongPressTimer, enabled, longPressMs, startDragFromPending]
  );

  const shouldCancelPendingForMove = useCallback((clientX: number, clientY: number) => {
    const pending = pendingRef.current;
    if (!pending) return false;
    if (activeRef.current) return false;
    const deltaX = Math.abs(clientX - pending.startX);
    const deltaY = Math.abs(clientY - pending.startY);
    if (deltaX > startMoveTolerancePx || deltaY > startMoveTolerancePx) {
      clearLongPressTimer();
      pendingRef.current = null;
      return true;
    }
    return false;
  }, [clearLongPressTimer, startMoveTolerancePx]);

  useEffect(() => {
    if (!enabled) return;
    const onDocTouchMovePreDrag = (event: TouchEvent) => {
      if (activeRef.current) return;
      const pending = pendingRef.current;
      if (!pending) return;
      const touch = findTouchById(event, pending.touchId);
      if (!touch) return;
      shouldCancelPendingForMove(touch.clientX, touch.clientY);
    };

    const onDocTouchEndPreDrag = (event: TouchEvent) => {
      if (activeRef.current) return;
      const pending = pendingRef.current;
      if (!pending) return;
      const touch = findTouchById(event, pending.touchId);
      if (!touch) return;
      clearLongPressTimer();
      pendingRef.current = null;
    };

    document.addEventListener("touchmove", onDocTouchMovePreDrag, { passive: true });
    document.addEventListener("touchend", onDocTouchEndPreDrag, { passive: true });
    document.addEventListener("touchcancel", onDocTouchEndPreDrag, { passive: true });
    return () => {
      document.removeEventListener("touchmove", onDocTouchMovePreDrag);
      document.removeEventListener("touchend", onDocTouchEndPreDrag);
      document.removeEventListener("touchcancel", onDocTouchEndPreDrag);
    };
  }, [clearLongPressTimer, enabled, shouldCancelPendingForMove]);

  return {
    getTouchStartProps,
    initialPositionRef,
    cancel,
    isDragActiveRef: activeRef,
  };
}
