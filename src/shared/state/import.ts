/**
 * Import Module
 *
 * Provides functionality to import state from JSON,
 * including validation, migration, and store hydration.
 */

import type { PersistedState } from './types';
import { migratePersistedState } from './local';
import { STORAGE_KEY } from './types';
import { useHakuStore } from './store';

export type ImportResult = { ok: true } | { ok: false; error: string };

/**
 * Imports state from a JSON string.
 *
 * This performs:
 * 1. JSON parsing with validation
 * 2. Schema validation and migration
 * 3. Store hydration (staged)
 * 4. Persistence to localStorage (committed)
 *
 * If any step fails, the current state and localStorage are left unchanged.
 *
 * @param json - The JSON string to import
 * @returns Result indicating success or failure with error message
 */
export function importStateFromJson(json: string): ImportResult {
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

  const previousStore = getStoreSnapshot();
  const previousRaw = readPersistedRawState();

  if (previousRaw.error) {
    return { ok: false, error: 'Failed to save to localStorage' };
  }

  // Step 3: Hydrate the store (staged change)
  try {
    hydrateStoreFromState(migrated);
  } catch {
    rollbackImport(previousStore, previousRaw.value);
    return { ok: false, error: 'Failed to update app state' };
  }

  // Step 4: Persist to localStorage (commit)
  if (!writePersistedRawState(migrated)) {
    rollbackImport(previousStore, previousRaw.value);
    return { ok: false, error: 'Failed to save to localStorage' };
  }

  return { ok: true };
}

type StoreSnapshot = Pick<PersistedState, 'activities' | 'lists' | 'settings'>;

function getStoreSnapshot(): StoreSnapshot {
  const state = useHakuStore.getState();
  return {
    activities: state.activities,
    lists: state.lists,
    settings: state.settings,
  };
}

function rollbackImport(snapshot: StoreSnapshot, rawState: string | null): void {
  try {
    useHakuStore.setState(snapshot);
  } catch {
    // best-effort rollback
  }

  try {
    if (rawState === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, rawState);
    }
  } catch {
    // best-effort rollback
  }
}

function readPersistedRawState(): { error: false; value: string | null } | { error: true } {
  try {
    return { error: false, value: localStorage.getItem(STORAGE_KEY) };
  } catch {
    return { error: true };
  }
}

function writePersistedRawState(state: PersistedState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
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
