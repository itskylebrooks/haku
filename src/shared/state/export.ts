/**
 * Export Module
 *
 * Provides functionality to export the current app state as JSON,
 * including browser download capability.
 */

import type { PersistedState } from './types';
import { CURRENT_SCHEMA_VERSION } from './types';
import { useHakuStore } from './store';

/**
 * Creates a PersistedState object from the current store state.
 */
export function createPersistedStateSnapshot(): PersistedState {
  const state = useHakuStore.getState();

  return {
    version: CURRENT_SCHEMA_VERSION,
    activities: state.activities,
    lists: state.lists,
    settings: state.settings,
  };
}

/**
 * Exports the current store state to a formatted JSON string.
 *
 * @returns A pretty-printed JSON string of the persisted state
 */
export function exportStateToJson(): string {
  const state = createPersistedStateSnapshot();
  return JSON.stringify(state, null, 2);
}

/**
 * Triggers a browser download for a JSON string.
 *
 * @param filename - The name of the file to download
 * @param jsonString - The JSON content to download
 */
export function createDownloadForJson(filename: string, jsonString: string): void {
  try {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('[Haku] Failed to create download:', error);
    throw new Error('Failed to create download');
  }
}

/**
 * Exports the current app state and triggers a browser download.
 *
 * @param filename - Optional custom filename (defaults to haku-backup-{date}.json)
 */
export function downloadStateAsJson(filename?: string): void {
  const defaultFilename = `Haku-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const json = exportStateToJson();
  createDownloadForJson(filename ?? defaultFilename, json);
}
