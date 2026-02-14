/**
 * Import Module
 *
 * Provides functionality to import state from JSON,
 * including validation, migration, and store hydration.
 */

import { migratePersistedState, savePersistedState } from './local';
import { useHakuStore } from './store';
import { STORAGE_KEY, type PersistedState } from './types';

export type ImportResult = { ok: true } | { ok: false; error: string };

/**
 * Imports state from a JSON string.
 *
 * This performs:
 * 1. JSON parsing with validation
 * 2. Schema validation and migration
 * 3. Persistence to localStorage
 * 4. Store hydration
 *
 * If any step fails, the current state and localStorage are left unchanged.
 *
 * @param json - The JSON string to import
 * @returns Result indicating success or failure with error message
 */
export function importStateFromJson(json: string): ImportResult {
  const previousState = createPersistedStateFromStore();
  const previousStorage = readRawStorage();

  // Step 1: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Invalid JSON format' };
  }

  // Step 2: Validate and migrate
  const migrated = migratePersistedState(parsed);
  if (migrated === null) {
    return { ok: false, error: 'Invalid or incompatible backup file' };
  }

  // Step 3: Hydrate the store
  try {
    hydrateStoreFromState(migrated);
  } catch {
    restorePreviousState(previousState, previousStorage);
    return { ok: false, error: 'Failed to update app state' };
  }

  // Step 4: Persist to localStorage
  if (!savePersistedState(migrated)) {
    restorePreviousState(previousState, previousStorage);
    return { ok: false, error: 'Failed to save to localStorage' };
  }

  return { ok: true };
}

/**
 * Hydrates the Zustand store with the provided persisted state.
 */
function hydrateStoreFromState(state: PersistedState): void {
  useHakuStore.setState({
    activities: state.activities,
    lists: state.lists,
    settings: state.settings,
  });
}

function createPersistedStateFromStore(): PersistedState {
  const state = useHakuStore.getState();
  return {
    version: 1,
    activities: state.activities,
    lists: state.lists,
    settings: state.settings,
  };
}

function readRawStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function restorePreviousState(state: PersistedState, rawStorage: string | null): void {
  hydrateStoreFromState(state);

  try {
    if (rawStorage === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, rawStorage);
    }
  } catch {
    // Ignore rollback failures caused by unavailable storage.
  }
}

/**
 * Reads a file and returns its contents as a string.
 * Useful for handling file input from the browser.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Imports state from a File object (e.g., from file input).
 *
 * @param file - The file to import
 * @returns Result indicating success or failure with error message
 */
export async function importStateFromFile(file: File): Promise<ImportResult> {
  if (!file.name.endsWith('.json')) {
    return { ok: false, error: 'Please select a JSON file' };
  }

  try {
    const json = await readFileAsText(file);
    return importStateFromJson(json);
  } catch {
    return { ok: false, error: 'Failed to read file' };
  }
}
