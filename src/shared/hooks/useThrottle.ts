import { useCallback, useEffect, useMemo, useRef } from 'react';

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
  delay: number,
): ThrottledFunction<Args> {
  const lastCallRef = useRef<number>(0);
  const pendingArgsRef = useRef<Args | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  const delayRef = useRef(delay);

  useEffect(() => {
    callbackRef.current = callback;
    delayRef.current = delay;
  }, [callback, delay]);

  const runPending = useCallback(() => {
    if (pendingArgsRef.current !== null) {
      lastCallRef.current = Date.now();
      callbackRef.current(...pendingArgsRef.current);
      pendingArgsRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

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

      const currentDelay = delayRef.current;
      if (timeSinceLastCall >= currentDelay) {
        // Enough time has passed, execute immediately
        lastCallRef.current = now;
        callbackRef.current(...args);
      } else {
        // Store args and schedule execution for remaining time
        pendingArgsRef.current = args;
        if (timeoutRef.current === null) {
          timeoutRef.current = window.setTimeout(runPending, currentDelay - timeSinceLastCall);
        }
      }
    },
    [runPending],
  );

  useEffect(() => cancel, [cancel]);

  return useMemo(
    () =>
      // The returned callback reads refs only when invoked, never during render.
      // eslint-disable-next-line react-hooks/refs
      Object.assign((...args: Args) => throttled(...args), {
        cancel,
        flush: runPending,
      }) as ThrottledFunction<Args>,
    [cancel, runPending, throttled],
  );
}
