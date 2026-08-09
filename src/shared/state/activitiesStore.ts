/**
 * Backwards-compatible export for the activity store.
 * Prefer importing from the state index (`@/shared/state`) going forward.
 */

export { useHakuStore as useActivitiesStore } from './browserStore';
export {
  getInboxActivities,
  getLaterActivities,
  getActivitiesForDate,
  getActivitiesForWeek,
} from './store';

export type { HakuStoreState as ActivitiesState } from './store';
