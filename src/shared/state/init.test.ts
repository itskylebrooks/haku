import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHakuStore } from './browserStore';
import { cleanupPersistence, initializePersistence, setupPersistenceFlushHandlers } from './init';
import { STORAGE_KEY } from './types';

describe('persistence initialization', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanupPersistence();
  });

  afterEach(() => {
    cleanupPersistence();
    vi.useRealTimers();
  });

  it('debounces store persistence', () => {
    initializePersistence();
    useHakuStore.getState().setThemeMode('dark');

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(300);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('flushes pending state on pagehide', () => {
    initializePersistence();
    const removeHandlers = setupPersistenceFlushHandlers();
    useHakuStore.getState().setThemeMode('light');

    window.dispatchEvent(new PageTransitionEvent('pagehide'));

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    removeHandlers();
  });
});
