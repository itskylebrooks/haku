/**
 * Haku Store
 *
 * Pure Zustand store factory combining activities, lists, and settings.
 * Browser hydration and persistence are composed in browserStore.ts.
 */

import { create } from 'zustand';

import {
  createActivityEntity,
  moveActivityInCollection,
  normalizeActivityPlacement,
  type MoveActivityInput,
  type NewActivityInput,
  updateActivityEntity,
} from '../domain/activity';
import type { Activity, Bucket } from '../types/activity';
import { isScheduled } from '../types/activity';
import { getCalendarWeekDates, todayLocal } from '../utils/calendarDate';
import type { ListsState, Settings } from './types';
import { getDefaultActivities, getDefaultListsState, getDefaultSettings } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HakuStoreState {
  // Core state
  activities: Activity[];
  lists: ListsState;
  settings: Settings;

  // Activity actions
  addActivity: (input: NewActivityInput) => Activity;
  updateActivity: (id: string, updates: Partial<Omit<Activity, 'id' | 'createdAt'>>) => void;
  deleteActivity: (id: string) => void;
  moveToInbox: (id: string) => void;
  moveToLater: (id: string) => void;
  scheduleActivity: (id: string, date: string) => void;
  unscheduleToInbox: (id: string) => void;
  setTime: (id: string, time: string | null, durationMinutes?: number | null) => void;
  toggleDone: (id: string) => void;
  reorderInDay: (date: string, orderedIds: string[]) => void;
  reorderInBucket: (bucket: Extract<Bucket, 'inbox' | 'later'>, orderedIds: string[]) => void;
  moveActivity: (input: MoveActivityInput) => void;

  // Settings actions
  setWeekStart: (weekStart: Settings['weekStart']) => void;
  setThemeMode: (themeMode: Settings['themeMode']) => void;

  // Persistence actions
  resetAllData: () => void;
}

export type HakuDataState = Pick<HakuStoreState, 'activities' | 'lists' | 'settings'>;

export interface HakuStoreDependencies {
  initialState: HakuDataState;
  generateId?: () => string;
  now?: () => string;
  today?: () => string;
  onReset?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fallbackActivityId = (() => {
  let counter = 0;
  return () => `activity_${Date.now()}_${counter++}`;
})();

const defaultGenerateId = (): string => globalThis.crypto?.randomUUID?.() ?? fallbackActivityId();

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const createHakuStore = (dependencies: HakuStoreDependencies) => {
  const generateId = dependencies.generateId ?? defaultGenerateId;
  const getNow = dependencies.now ?? (() => new Date().toISOString());
  const getToday = dependencies.today ?? todayLocal;

  return create<HakuStoreState>((set) => ({
    // Initial state
    ...dependencies.initialState,

    // ─────────────────────────────────────────────────────────────────────────
    // Activity Actions
    // ─────────────────────────────────────────────────────────────────────────

    addActivity: (input) => {
      const now = getNow();
      const newActivity = createActivityEntity(input, {
        id: generateId(),
        now,
        today: getToday(),
      });

      set((state) => ({ activities: [...state.activities, newActivity] }));

      return newActivity;
    },

    updateActivity: (id, updates) => {
      if (Object.keys(updates).length === 0) {
        return;
      }

      set((state) => {
        const now = getNow();
        const { updatedAt, ...restUpdates } = updates;
        void updatedAt; // Mark as intentionally unused
        let modified = false;

        const activities = state.activities.map((activity): Activity => {
          if (activity.id !== id) {
            return activity;
          }

          const updated = updateActivityEntity(activity, restUpdates, {
            now,
            today: getToday(),
          });
          if (updated === activity) return activity;

          modified = true;
          return updated;
        });

        return modified ? { activities } : state;
      });
    },

    deleteActivity: (id) => {
      set((state) => ({
        activities: state.activities.filter((activity) => activity.id !== id),
      }));
    },

    moveToInbox: (id) => {
      set((state) => {
        const now = getNow();
        let changed = false;
        const activities = state.activities.map((activity): Activity => {
          if (activity.id !== id) {
            return activity;
          }
          if (activity.isDone) {
            return activity;
          }
          const needsUpdate =
            activity.bucket !== 'inbox' || activity.date !== null || activity.time !== null;
          if (!needsUpdate) {
            return activity;
          }
          changed = true;
          return {
            ...activity,
            bucket: 'inbox',
            date: null,
            time: null,
            durationMinutes: null,
            updatedAt: now,
          };
        });
        return changed ? { activities } : state;
      });
    },

    moveToLater: (id) => {
      set((state) => {
        const now = getNow();
        let changed = false;
        const activities = state.activities.map((activity): Activity => {
          if (activity.id !== id) {
            return activity;
          }
          if (activity.isDone) {
            return activity;
          }
          const needsUpdate =
            activity.bucket !== 'later' || activity.date !== null || activity.time !== null;
          if (!needsUpdate) {
            return activity;
          }
          changed = true;
          return {
            ...activity,
            bucket: 'later',
            date: null,
            time: null,
            durationMinutes: null,
            updatedAt: now,
          };
        });
        return changed ? { activities } : state;
      });
    },

    scheduleActivity: (id, date) => {
      set((state) => {
        const now = getNow();
        let changed = false;
        const activities = state.activities.map((activity): Activity => {
          if (activity.id !== id) {
            return activity;
          }
          const placement = normalizeActivityPlacement(
            'scheduled',
            date,
            activity.time,
            activity.durationMinutes,
            getToday(),
          );
          if (activity.bucket === 'scheduled' && activity.date === placement.date) {
            return activity;
          }
          changed = true;
          return {
            ...activity,
            ...placement,
            updatedAt: now,
          };
        });
        return changed ? { activities } : state;
      });
    },

    unscheduleToInbox: (id) => {
      set((state) => {
        const now = getNow();
        let changed = false;
        const activities = state.activities.map((activity): Activity => {
          if (activity.id !== id) {
            return activity;
          }
          if (activity.isDone) {
            return activity;
          }
          const needsUpdate =
            activity.bucket !== 'inbox' || activity.date !== null || activity.time !== null;
          if (!needsUpdate) {
            return activity;
          }
          changed = true;
          return {
            ...activity,
            bucket: 'inbox',
            date: null,
            time: null,
            durationMinutes: null,
            updatedAt: now,
          };
        });
        return changed ? { activities } : state;
      });
    },

    setTime: (id, time, durationMinutes) => {
      set((state) => {
        const now = getNow();
        let changed = false;
        const activities = state.activities.map((activity): Activity => {
          if (activity.id !== id) {
            return activity;
          }

          const placement = normalizeActivityPlacement(
            activity.bucket,
            activity.date,
            time,
            durationMinutes !== undefined ? durationMinutes : activity.durationMinutes,
            getToday(),
          );

          if (
            activity.time === placement.time &&
            activity.durationMinutes === placement.durationMinutes
          ) {
            return activity;
          }

          changed = true;
          return {
            ...activity,
            ...placement,
            updatedAt: now,
          };
        });
        return changed ? { activities } : state;
      });
    },

    toggleDone: (id) => {
      set((state) => {
        const now = getNow();
        const today = getToday();
        let changed = false;

        const activities = state.activities.map((activity): Activity => {
          if (activity.id !== id) {
            return activity;
          }

          const nextIsDone = !activity.isDone;
          const shouldScheduleToday =
            nextIsDone && (activity.bucket === 'inbox' || activity.bucket === 'later');

          changed = true;

          if (!shouldScheduleToday) {
            return {
              ...activity,
              isDone: nextIsDone,
              updatedAt: now,
            };
          }

          return {
            ...activity,
            bucket: 'scheduled',
            date: today,
            time: null,
            durationMinutes: null,
            orderIndex: null,
            isDone: nextIsDone,
            updatedAt: now,
          };
        });

        return changed ? { activities } : state;
      });
    },

    reorderInDay: (date, orderedIds) => {
      set((state) => {
        const orderMap = new Map<string, number>();
        orderedIds.forEach((activityId, index) => {
          orderMap.set(activityId, index);
        });

        const now = getNow();
        let changed = false;

        const activities = state.activities.map((activity): Activity => {
          if (activity.date !== date) {
            return activity;
          }

          const nextOrderIndex = orderMap.get(activity.id);
          if (nextOrderIndex === undefined || activity.orderIndex === nextOrderIndex) {
            return activity;
          }

          changed = true;
          return {
            ...activity,
            orderIndex: nextOrderIndex,
            updatedAt: now,
          };
        });

        return changed ? { activities } : state;
      });
    },

    reorderInBucket: (bucket, orderedIds) => {
      set((state) => {
        const orderMap = new Map<string, number>();
        orderedIds.forEach((activityId, index) => {
          orderMap.set(activityId, index);
        });

        const now = getNow();
        let changed = false;

        const activities = state.activities.map((activity): Activity => {
          if (activity.bucket !== bucket) {
            return activity;
          }

          const nextOrderIndex = orderMap.get(activity.id);
          if (nextOrderIndex === undefined || activity.orderIndex === nextOrderIndex) {
            return activity;
          }

          changed = true;
          return {
            ...activity,
            orderIndex: nextOrderIndex,
            updatedAt: now,
          };
        });

        return changed ? { activities } : state;
      });
    },

    moveActivity: (input) => {
      set((state) => {
        const activities = moveActivityInCollection(state.activities, input, {
          now: getNow(),
          today: getToday(),
        });
        return activities === state.activities ? state : { activities };
      });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Settings Actions
    // ─────────────────────────────────────────────────────────────────────────

    setWeekStart: (weekStart) => {
      set((state) => ({
        settings: { ...state.settings, weekStart },
      }));
    },

    setThemeMode: (themeMode) => {
      set((state) => ({
        settings: { ...state.settings, themeMode },
      }));
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Persistence Actions
    // ─────────────────────────────────────────────────────────────────────────

    resetAllData: () => {
      dependencies.onReset?.();
      set({
        activities: getDefaultActivities(),
        lists: getDefaultListsState(),
        settings: getDefaultSettings(),
      });
    },
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// Selectors (exported for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export const getInboxActivities = (activities: Activity[]): Activity[] =>
  activities
    .filter((activity) => activity.bucket === 'inbox')
    .sort((a, b) => {
      if (a.orderIndex !== null && b.orderIndex !== null) {
        return a.orderIndex - b.orderIndex;
      }
      if (a.orderIndex !== null) {
        return -1;
      }
      if (b.orderIndex !== null) {
        return 1;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

export const getLaterActivities = (activities: Activity[]): Activity[] =>
  activities
    .filter((activity) => activity.bucket === 'later')
    .sort((a, b) => {
      if (a.orderIndex !== null && b.orderIndex !== null) {
        return a.orderIndex - b.orderIndex;
      }
      if (a.orderIndex !== null) {
        return -1;
      }
      if (b.orderIndex !== null) {
        return 1;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

export const getActivitiesForDate = (activities: Activity[], date: string): Activity[] =>
  activities.filter((activity) => isScheduled(activity) && activity.date === date);

export const getActivitiesForWeek = (
  activities: Activity[],
  weekStartDate: string,
): Record<string, Activity[]> => {
  const dates = getCalendarWeekDates(weekStartDate);
  return dates.reduce<Record<string, Activity[]>>(
    (acc, date) => {
      acc[date] = getActivitiesForDate(activities, date);
      return acc;
    },
    {} as Record<string, Activity[]>,
  );
};
