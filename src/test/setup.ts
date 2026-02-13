import { afterEach, vi } from 'vitest';

const ensureStorage = () => {
  if (
    typeof globalThis.localStorage !== 'undefined' &&
    typeof globalThis.localStorage.getItem === 'function' &&
    typeof globalThis.localStorage.setItem === 'function' &&
    typeof globalThis.localStorage.removeItem === 'function' &&
    typeof globalThis.localStorage.clear === 'function'
  ) {
    return;
  }

  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
    configurable: true,
  });
};

ensureStorage();

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
