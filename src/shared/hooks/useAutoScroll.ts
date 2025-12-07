import { useRef, useCallback } from "react";

/**
 * Hook to enable auto-scrolling when dragging near viewport edges on mobile.
 * Returns functions to start/stop auto-scrolling based on touch position.
 */
export const useAutoScroll = () => {
  const autoScrollIntervalRef = useRef<number | null>(null);

  const startAutoScroll = useCallback((clientY: number) => {
    const SCROLL_ZONE = 80; // pixels from top/bottom to trigger scroll
    const SCROLL_SPEED = 8; // pixels per frame
    const viewportHeight = window.innerHeight;

    // Clear existing auto-scroll
    if (autoScrollIntervalRef.current !== null) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    // Check if near top or bottom
    if (clientY < SCROLL_ZONE) {
      // Near top - scroll up
      autoScrollIntervalRef.current = window.setInterval(() => {
        window.scrollBy(0, -SCROLL_SPEED);
      }, 16);
    } else if (clientY > viewportHeight - SCROLL_ZONE) {
      // Near bottom - scroll down
      autoScrollIntervalRef.current = window.setInterval(() => {
        window.scrollBy(0, SCROLL_SPEED);
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
