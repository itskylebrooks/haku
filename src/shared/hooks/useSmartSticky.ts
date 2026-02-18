import { useEffect, useRef, useState } from 'react';

// Detect scroll direction and manage smart sticky visibility on mobile.
export const useSmartSticky = (viewKey?: string) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const lastScrollY = useRef(0);
  const lastDirection = useRef<'up' | 'down' | null>(null);
  const accumulatedDelta = useRef(0);
  // Lock scroll handling briefly after view changes to prevent jumping.
  const isNavigating = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(max-width: 768px)');

    const handleMediaChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
      if (!event.matches) {
        setIsVisible(true);
      }
    };

    handleMediaChange(mediaQuery);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
      return () => {
        mediaQuery.removeEventListener('change', handleMediaChange);
      };
    }

    mediaQuery.addListener(handleMediaChange);
    return () => {
      mediaQuery.removeListener(handleMediaChange);
    };
  }, []);

  // Expand tab bar when view changes and lock scroll handling briefly.
  useEffect(() => {
    if (!(viewKey && isMobile) || typeof window === 'undefined') return;
    const scrollContainer = document.querySelector('main');
    const getScrollY = () =>
      scrollContainer instanceof HTMLElement ? scrollContainer.scrollTop : window.scrollY;

    isNavigating.current = true;
    accumulatedDelta.current = 0;
    lastDirection.current = null;
    lastScrollY.current = 0;

    queueMicrotask(() => {
      setIsVisible(true);
    });

    const timeoutId = window.setTimeout(() => {
      isNavigating.current = false;
      lastScrollY.current = getScrollY();
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [viewKey, isMobile]);

  useEffect(() => {
    if (!isMobile || typeof window === 'undefined') return;

    let ticking = false;
    const TOP_THRESHOLD = 40;
    const HIDE_THRESHOLD = 18;
    const SHOW_THRESHOLD = 28;
    const MIN_DELTA = 2;
    const scrollContainer = document.querySelector('main');
    const getScrollY = () =>
      scrollContainer instanceof HTMLElement ? scrollContainer.scrollTop : window.scrollY;

    const handleScroll = () => {
      if (isNavigating.current || ticking) return;

      window.requestAnimationFrame(() => {
        if (isNavigating.current) {
          ticking = false;
          return;
        }

        const currentScrollY = getScrollY();
        const delta = currentScrollY - lastScrollY.current;

        if (Math.abs(delta) < MIN_DELTA) {
          lastScrollY.current = currentScrollY;
          ticking = false;
          return;
        }

        const direction: 'up' | 'down' = delta > 0 ? 'down' : 'up';
        if (direction !== lastDirection.current) {
          accumulatedDelta.current = 0;
          lastDirection.current = direction;
        }

        accumulatedDelta.current += Math.abs(delta);

        if (currentScrollY < TOP_THRESHOLD) {
          setIsVisible(true);
          accumulatedDelta.current = 0;
        } else if (direction === 'down' && accumulatedDelta.current > HIDE_THRESHOLD) {
          setIsVisible(false);
          accumulatedDelta.current = 0;
        } else if (direction === 'up' && accumulatedDelta.current > SHOW_THRESHOLD) {
          setIsVisible(true);
          accumulatedDelta.current = 0;
        }

        lastScrollY.current = currentScrollY;
        ticking = false;
      });

      ticking = true;
    };

    lastScrollY.current = getScrollY();
    window.addEventListener('scroll', handleScroll, { passive: true });
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isMobile]);

  return { isVisible, isMobile };
};
