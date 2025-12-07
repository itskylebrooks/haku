/**
 * Storage Module - Public API
 * 
 * This is the main entry point for the Haku persistence layer.
 * Import from this file for all storage-related functionality.
 */

// Types
export type {
  Settings,
  ListsState,
  PersistedState,
  PersistedStateV1,
  WeekStart,
  ThemeMode,
} from "./types";

export {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  getDefaultSettings,
  getDefaultListsState,
  getDefaultActivities,
  getDefaultPersistedState,
} from "./types";

// Store
export {
  useHakuStore,
  getInboxActivities,
  getLaterActivities,
  getActivitiesForDate,
  getActivitiesForWeek,
  createPersistedStateFromStore,
} from "./store";

export type { HakuStoreState } from "./store";

// Local storage operations
export {
  loadPersistedState,
  savePersistedState,
  clearPersistedState,
  migratePersistedState,
  isStorageAvailable,
} from "./local";

// Export functionality
export {
  exportStateToJson,
  createDownloadForJson,
  downloadStateAsJson,
  createPersistedStateSnapshot,
} from "./export";

// Import functionality
export {
  importStateFromJson,
  importStateFromFile,
  readFileAsText,
} from "./import";

export type { ImportResult } from "./import";

// Initialization
export {
  initializePersistence,
  cleanupPersistence,
  persistNow,
  setupUnloadHandler,
} from "./init";
