/**
 * Persistence Initialization Module
 *
 * Sets up a debounced subscription to automatically persist store state
 * to localStorage. This module should be imported once at app startup.
 */

import { useHakuStore, createPersistedStateFromStore } from './browserStore';
import { savePersistedState } from './local';

// ─────────────────────────────────────────────────────────────────────────────
// Debounce Helper
// ─────────────────────────────────────────────────────────────────────────────

function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence Subscription
// ─────────────────────────────────────────────────────────────────────────────

let initialized = false;
let unsubscribe: (() => void) | null = null;

/**
 * Debounce delay for persisting state changes (in milliseconds).
 * A small delay prevents hammering localStorage on rapid updates.
 */
const PERSIST_DEBOUNCE_MS = 300;

/**
 * Persists the current store state to localStorage.
 */
function persistCurrentState(): void {
  const state = createPersistedStateFromStore();
  savePersistedState(state);
}

/**
 * Debounced version of persistCurrentState.
 */
const debouncedPersist = debounce(persistCurrentState, PERSIST_DEBOUNCE_MS);

/**
 * Initializes the persistence subscription.
 *
 * This sets up a Zustand store subscription that automatically
 * saves state changes to localStorage with debouncing.
 *
 * Call this once at app startup (e.g., in main.tsx before rendering).
 */
export function initializePersistence(): void {
  if (initialized) {
    console.warn('[Haku] Persistence already initialized');
    return;
  }

  // Subscribe to store changes
  unsubscribe = useHakuStore.subscribe(() => {
    debouncedPersist();
  });

  initialized = true;
}

/**
 * Cleans up the persistence subscription.
 *
 * Useful for testing or hot module replacement scenarios.
 */
export function cleanupPersistence(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  debouncedPersist.cancel();
  initialized = false;
}

/**
 * Forces an immediate persist (bypasses debounce).
 *
 * Useful before page unload or when you need guaranteed persistence.
 */
export function persistNow(): void {
  debouncedPersist.cancel();
  persistCurrentState();
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle flush handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flushes pending state when the page is hidden or discarded. `pagehide` and
 * `visibilitychange` cover mobile/PWA lifecycle transitions where
 * `beforeunload` may not run.
 */
export function setupPersistenceFlushHandlers(): () => void {
  const handleFlush = () => persistNow();
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') handleFlush();
  };

  window.addEventListener('beforeunload', handleFlush);
  window.addEventListener('pagehide', handleFlush);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('beforeunload', handleFlush);
    window.removeEventListener('pagehide', handleFlush);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
