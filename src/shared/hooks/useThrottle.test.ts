import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThrottledCallback } from './useThrottle';

describe('useThrottledCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes the latest callback after a rerender', () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const onReady = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    const TestComponent = ({ callback }: { callback: (value: string) => void }) => {
      const throttled = useThrottledCallback(callback, 25);
      useEffect(() => onReady(throttled), [throttled]);
      return null;
    };

    act(() => root.render(createElement(TestComponent, { callback: firstCallback })));
    const invoke = onReady.mock.lastCall?.[0] as (value: string) => void;
    act(() => invoke('first'));
    act(() => vi.advanceTimersByTime(25));

    act(() => root.render(createElement(TestComponent, { callback: secondCallback })));
    act(() => invoke('second'));
    act(() => vi.advanceTimersByTime(25));

    expect(firstCallback).toHaveBeenCalledWith('first');
    expect(firstCallback).not.toHaveBeenCalledWith('second');
    expect(secondCallback).toHaveBeenCalledWith('second');
    act(() => root.unmount());
  });
});
