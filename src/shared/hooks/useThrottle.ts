import { useRef, useCallback, useEffect, useMemo } from "react";

type ThrottledFunction<Args extends unknown[]> = ((...args: Args) => void) & {
  cancel: () => void;
  flush: () => void;
};

/**
 * Returns a throttled version of the callback that only executes at most once
 * per the specified interval. Useful for limiting expensive operations like
 * state updates during rapid events like touchmove.
 */
export function useThrottledCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number
): ThrottledFunction<Args> {
  const lastCallRef = useRef<number>(0);
  const pendingArgsRef = useRef<Args | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const runPending = useCallback(() => {
    if (pendingArgsRef.current !== null) {
      lastCallRef.current = Date.now();
      callback(...pendingArgsRef.current);
      pendingArgsRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingArgsRef.current = null;
  }, []);

  const throttled = useCallback(
    (...args: Args) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        // Enough time has passed, execute immediately
        lastCallRef.current = now;
        callback(...args);
      } else {
        // Store args and schedule execution for remaining time
        pendingArgsRef.current = args;
        if (timeoutRef.current === null) {
          timeoutRef.current = window.setTimeout(runPending, delay - timeSinceLastCall);
        }
      }
    },
    [callback, delay, runPending]
  );

  useEffect(() => cancel, [cancel]);

  return useMemo(
    () =>
      Object.assign(throttled, {
        cancel,
        flush: runPending,
      }),
    [cancel, runPending, throttled]
  );
}
