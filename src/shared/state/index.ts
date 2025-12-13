/**
 * State Module - Public API
 *
 * Main entry point for the Haku store and persistence layer.
 * Import from this file for all state-related functionality.
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

// Backcompat alias for activity store naming
export {
  useActivitiesStore,
} from "./activitiesStore";
export type { ActivitiesState } from "./activitiesStore";

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
