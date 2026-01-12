/**
 * Export Module
 *
 * Provides functionality to export the current app state as JSON,
 * including browser download capability.
 */

import pkg from '../../../package.json';
import { useHakuStore } from './store';

/**
 * Creates an export-ready object from the current store state.
 * The exported JSON has the following ordered structure:
 * {
 *   app: 'haku',
 *   version: '<app version from package.json>',
 *   exportedAt: '<ISO timestamp>',
 *   activities: [...],
 *   lists: {...},
 *   settings: {...}
 * }
 */
export function createPersistedStateSnapshot() {
  const state = useHakuStore.getState();

  return {
    app: 'haku',
    version: pkg.version,
    exportedAt: new Date().toISOString(),
    activities: state.activities,
    lists: state.lists,
    settings: state.settings,
  } as const;
}

/**
 * Exports the current store state to a formatted JSON string.
 *
 * @returns A pretty-printed JSON string of the exported state
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
  const defaultFilename = `haku-export-${new Date().toISOString().slice(0, 10)}.json`;
  const json = exportStateToJson();
  createDownloadForJson(filename ?? defaultFilename, json);
}
