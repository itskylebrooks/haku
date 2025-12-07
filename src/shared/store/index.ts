/**
 * Store exports - re-exported from storage module for backward compatibility.
 * 
 * The unified store now lives in the storage module.
 * This file maintains backward compatibility for existing imports.
 */

// Re-export the unified store as the activities store for backward compatibility
export {
  useHakuStore as useActivitiesStore,
  useHakuStore,
  getInboxActivities,
  getLaterActivities,
  getActivitiesForDate,
  getActivitiesForWeek,
} from "../storage";

export type { HakuStoreState as ActivitiesState } from "../storage";
