import { useRef, useCallback, useEffect } from "react";

/**
 * Hook to enable auto-scrolling when dragging near viewport edges on mobile.
 * Returns functions to start/stop auto-scrolling based on touch position.
 */
export const useAutoScroll = (scrollContainer?: HTMLElement | Window | null) => {
  const autoScrollIntervalRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLElement | Window | null | undefined>(scrollContainer);

  useEffect(() => {
    scrollContainerRef.current = scrollContainer;
  }, [scrollContainer]);

  const startAutoScroll = useCallback((clientY: number) => {
    const SCROLL_ZONE = 80; // pixels from top/bottom to trigger scroll
    const SCROLL_SPEED = 8; // pixels per frame
    const container = scrollContainerRef.current ?? window;
    const isWindow = !container || container === window;
    const viewportHeight = isWindow
      ? window.innerHeight
      : (container as HTMLElement).clientHeight;

    // Clear existing auto-scroll
    if (autoScrollIntervalRef.current !== null) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    // Check if near top or bottom
    // If container is an element, compute the y relative to the container's rect
    let nearTop = false;
    let nearBottom = false;
    if (!isWindow) {
      const elem = container as HTMLElement;
      // If the element isn't scrollable, nothing to do
      if (elem.scrollHeight <= elem.clientHeight) {
        return;
      }
      const rect = elem.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      nearTop = relativeY < SCROLL_ZONE;
      nearBottom = relativeY > rect.height - SCROLL_ZONE;
    } else {
      // window
      nearTop = clientY < SCROLL_ZONE;
      nearBottom = clientY > viewportHeight - SCROLL_ZONE;
    }

    if (nearTop) {
      // Scroll up
      autoScrollIntervalRef.current = window.setInterval(() => {
        if (isWindow) {
          window.scrollBy(0, -SCROLL_SPEED);
        } else {
          const elem = container as HTMLElement;
          if (typeof elem.scrollBy === "function") {
            // cast to any to avoid TS complaining in old lib versions
            (elem as any).scrollBy(0, -SCROLL_SPEED);
          } else {
            elem.scrollTop = Math.max(0, elem.scrollTop - SCROLL_SPEED);
          }
        }
      }, 16);
    } else if (nearBottom) {
      // Scroll down
      autoScrollIntervalRef.current = window.setInterval(() => {
        if (isWindow) {
          window.scrollBy(0, SCROLL_SPEED);
        } else {
          const elem = container as HTMLElement;
          if (typeof elem.scrollBy === "function") {
            (elem as any).scrollBy(0, SCROLL_SPEED);
          } else {
            elem.scrollTop = Math.min(elem.scrollHeight - elem.clientHeight, elem.scrollTop + SCROLL_SPEED);
          }
        }
      }, 16);
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current !== null) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  return { startAutoScroll, stopAutoScroll };
};
