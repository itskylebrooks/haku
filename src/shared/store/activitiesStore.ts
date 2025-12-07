/**
 * @deprecated This module is deprecated. Import from '../storage' instead.
 * 
 * This file maintains backward compatibility for existing imports.
 * The unified store now lives in the storage module.
 */

// Re-export everything from the unified store
export {
  useHakuStore as useActivitiesStore,
  getInboxActivities,
  getLaterActivities,
  getActivitiesForDate,
  getActivitiesForWeek,
} from "../storage/store";

export type { HakuStoreState as ActivitiesState } from "../storage/store";
