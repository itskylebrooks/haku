import { useRef, useCallback } from "react";

/**
 * Returns a throttled version of the callback that only executes at most once
 * per the specified interval. Useful for limiting expensive operations like
 * state updates during rapid events like touchmove.
 */
export function useThrottledCallback<Args extends unknown[]>(
    callback: (...args: Args) => void,
    delay: number
): (...args: Args) => void {
    const lastCallRef = useRef<number>(0);
    const pendingArgsRef = useRef<Args | null>(null);
    const timeoutRef = useRef<number | null>(null);

    return useCallback(
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
                    timeoutRef.current = window.setTimeout(() => {
                        if (pendingArgsRef.current !== null) {
                            lastCallRef.current = Date.now();
                            callback(...pendingArgsRef.current);
                            pendingArgsRef.current = null;
                        }
                        timeoutRef.current = null;
                    }, delay - timeSinceLastCall);
                }
            }
        },
        [callback, delay]
    );
}

