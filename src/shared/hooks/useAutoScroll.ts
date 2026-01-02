import { useRef, useCallback, useEffect } from 'react';

const SCROLL_ZONE = 80; // pixels from top/bottom to trigger scroll
const SCROLL_SPEED = 10; // pixels per frame
const RECT_REFRESH_INTERVAL = 100; // ms between rect refreshes during scroll

interface AutoScrollConfig {
  scrollContainer?: HTMLElement | Window | null;
  /** Called periodically during scrolling to allow refreshing cached rects */
  onScrolling?: () => void;
}

/**
 * Hook to enable auto-scrolling when dragging near viewport edges on mobile.
 * Uses requestAnimationFrame for smooth 60fps scrolling.
 * Optimized to avoid layout thrashing by caching container rect.
 */
export const useAutoScroll = (
  configOrContainer?: HTMLElement | Window | null | AutoScrollConfig,
) => {
  // Support both old signature (just container) and new signature (config object)
  const config =
    configOrContainer &&
    typeof configOrContainer === 'object' &&
    'scrollContainer' in configOrContainer
      ? (configOrContainer as AutoScrollConfig)
      : { scrollContainer: configOrContainer as HTMLElement | Window | null | undefined };

  const { scrollContainer, onScrolling } = config;

  const scrollContainerRef = useRef<HTMLElement | Window | null | undefined>(scrollContainer);
  const onScrollingRef = useRef(onScrolling);
  const rafIdRef = useRef<number | null>(null);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const cachedRectRef = useRef<DOMRect | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);

  useEffect(() => {
    scrollContainerRef.current = scrollContainer;
    onScrollingRef.current = onScrolling;
    // Cache the container rect on mount/change
    if (scrollContainer && scrollContainer !== window) {
      cachedRectRef.current = (scrollContainer as HTMLElement).getBoundingClientRect();
    } else {
      cachedRectRef.current = null;
    }
  }, [scrollContainer, onScrolling]);

  // Animation loop using rAF for smooth 60fps scrolling
  const scrollLoop = useCallback(() => {
    const container = scrollContainerRef.current ?? window;
    const isWindow = !container || container === window;
    const direction = scrollDirectionRef.current;

    if (!direction) {
      rafIdRef.current = null;
      return;
    }

    const speed = direction === 'up' ? -SCROLL_SPEED : SCROLL_SPEED;

    if (isWindow) {
      window.scrollBy(0, speed);
    } else {
      const elem = container as HTMLElement;
      elem.scrollTop += speed;
    }

    // Call onScrolling callback periodically to allow rect refresh
    const now = Date.now();
    if (now - lastRefreshTimeRef.current > RECT_REFRESH_INTERVAL) {
      lastRefreshTimeRef.current = now;
      onScrollingRef.current?.();
    }

    // Continue the loop
    rafIdRef.current = requestAnimationFrame(scrollLoop);
  }, []);

  const updateAutoScroll = useCallback(
    (clientY: number) => {
      const container = scrollContainerRef.current ?? window;
      const isWindow = !container || container === window;

      // Determine scroll direction based on position
      let nearTop = false;
      let nearBottom = false;

      if (!isWindow) {
        const elem = container as HTMLElement;
        // Skip if not scrollable
        if (elem.scrollHeight <= elem.clientHeight) {
          scrollDirectionRef.current = null;
          return;
        }
        // Use cached rect to avoid layout thrashing
        const rect = cachedRectRef.current ?? elem.getBoundingClientRect();
        const relativeY = clientY - rect.top;
        nearTop = relativeY < SCROLL_ZONE && elem.scrollTop > 0;
        nearBottom =
          relativeY > rect.height - SCROLL_ZONE &&
          elem.scrollTop < elem.scrollHeight - elem.clientHeight;
      } else {
        nearTop = clientY < SCROLL_ZONE && window.scrollY > 0;
        nearBottom =
          clientY > window.innerHeight - SCROLL_ZONE &&
          window.scrollY < document.documentElement.scrollHeight - window.innerHeight;
      }

      // Set direction
      if (nearTop) {
        scrollDirectionRef.current = 'up';
      } else if (nearBottom) {
        scrollDirectionRef.current = 'down';
      } else {
        scrollDirectionRef.current = null;
      }

      // Start animation loop if not already running and we have a direction
      if (scrollDirectionRef.current && rafIdRef.current === null) {
        lastRefreshTimeRef.current = Date.now();
        rafIdRef.current = requestAnimationFrame(scrollLoop);
      }
    },
    [scrollLoop],
  );

  const stopAutoScroll = useCallback(() => {
    scrollDirectionRef.current = null;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    startAutoScroll: updateAutoScroll,
    stopAutoScroll,
  };
};
