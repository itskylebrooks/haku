/**
 * Haku Store
 * 
 * Unified Zustand store combining activities, lists, and settings.
 * This store integrates with the persistence layer for automatic
 * saving and hydration from localStorage.
 */

import { create } from "zustand";
import type { Activity, Bucket, RepeatPattern } from "../types/activity";
import { isScheduled } from "../types/activity";
import type { Settings, ListsState, PersistedState } from "./types";
import {
  getDefaultActivities,
  getDefaultListsState,
  getDefaultSettings,
  CURRENT_SCHEMA_VERSION,
} from "./types";
import { loadPersistedState, clearPersistedState } from "./local";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AddActivityInput = {
  title: string;
  bucket?: Bucket;
  date?: string | null;
  time?: string | null;
  durationMinutes?: number | null;
  repeat?: RepeatPattern;
  note?: string | null;
};

export interface HakuStoreState {
  // Core state
  activities: Activity[];
  lists: ListsState;
  settings: Settings;

  // Activity actions
  addActivity: (input: AddActivityInput) => Activity;
  updateActivity: (
    id: string,
    updates: Partial<Omit<Activity, "id" | "createdAt">>
  ) => void;
  deleteActivity: (id: string) => void;
  moveToInbox: (id: string) => void;
  moveToLater: (id: string) => void;
  scheduleActivity: (id: string, date: string) => void;
  unscheduleToInbox: (id: string) => void;
  setTime: (
    id: string,
    time: string | null,
    durationMinutes?: number | null,
    repeat?: RepeatPattern
  ) => void;
  toggleDone: (id: string) => void;
  reorderInDay: (date: string, orderedIds: string[]) => void;
  reorderInBucket: (bucket: Extract<Bucket, "inbox" | "later">, orderedIds: string[]) => void;

  // Settings actions
  setWeekStart: (weekStart: Settings["weekStart"]) => void;
  setThemeMode: (themeMode: Settings["themeMode"]) => void;

  // Persistence actions
  resetAllData: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const generateActivityId = (() => {
  let counter = 0;
  return () => `activity_${Date.now()}_${counter++}`;
})();

const nowIsoString = () => new Date().toISOString();
const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const isValidDuration = (value: number): boolean =>
  Number.isFinite(value) &&
  value >= 15 &&
  value <= 300 &&
  value % 15 === 0;

const normalizeDurationMinutes = (value?: number | null): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return isValidDuration(value) ? value : null;
};

const normalizeRepeat = (value?: RepeatPattern | null): RepeatPattern => {
  if (value === "daily" || value === "weekly" || value === "monthly") {
    return value;
  }
  return "none";
};

const isScheduledWithTime = (bucket: Bucket, time: string | null): boolean =>
  bucket === "scheduled" && time !== null;

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

function getInitialState(): Pick<HakuStoreState, "activities" | "lists" | "settings"> {
  const persisted = loadPersistedState();
  
  if (persisted) {
    return {
      activities: persisted.activities,
      lists: persisted.lists,
      settings: persisted.settings,
    };
  }

  return {
    activities: getDefaultActivities(),
    lists: getDefaultListsState(),
    settings: getDefaultSettings(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

const initialState = getInitialState();

export const useHakuStore = create<HakuStoreState>((set) => ({
  // Initial state
  ...initialState,

  // ─────────────────────────────────────────────────────────────────────────
  // Activity Actions
  // ─────────────────────────────────────────────────────────────────────────

  addActivity: (input) => {
    const title = input.title.trim();
    const bucket = input.bucket ?? "inbox";
    const now = nowIsoString();

    const date = bucket === "scheduled" ? input.date ?? null : null;
    const time = bucket === "scheduled" ? input.time ?? null : null;
    const anchored = isScheduledWithTime(bucket, time);
    const durationMinutes = anchored
      ? normalizeDurationMinutes(input.durationMinutes)
      : null;
    const repeat = anchored ? normalizeRepeat(input.repeat) : "none";

    const newActivity: Activity = {
      id: generateActivityId(),
      title,
      bucket,
      date,
      time,
      durationMinutes,
      repeat,
      note: input.note ?? null,
      isDone: false,
      orderIndex: null,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({ activities: [...state.activities, newActivity] }));

    return newActivity;
  },

  updateActivity: (id, updates) => {
    if (Object.keys(updates).length === 0) {
      return;
    }

    set((state) => {
      const now = nowIsoString();
      const { updatedAt: _ignoredUpdatedAt, ...restUpdates } = updates;
      let modified = false;

      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }

        const requestedBucket = restUpdates.bucket ?? activity.bucket;
        const nextIsDone =
          restUpdates.isDone !== undefined ? restUpdates.isDone : activity.isDone;
        const nextBucket =
          nextIsDone && requestedBucket !== "scheduled"
            ? "scheduled"
            : requestedBucket;

        const nextDate =
          nextBucket === "scheduled" ? restUpdates.date ?? activity.date : null;

        const rawTime =
          restUpdates.time !== undefined ? restUpdates.time : activity.time;
        const anchored = isScheduledWithTime(nextBucket, rawTime);
        const nextTime = anchored ? rawTime : null;

        const rawDuration =
          restUpdates.durationMinutes !== undefined
            ? restUpdates.durationMinutes
            : activity.durationMinutes;
        const nextDuration = anchored
          ? normalizeDurationMinutes(rawDuration)
          : null;

        const rawRepeat =
          restUpdates.repeat !== undefined ? restUpdates.repeat : activity.repeat;
        const nextRepeat = anchored ? normalizeRepeat(rawRepeat) : "none";

        const nextTitle = restUpdates.title ?? activity.title;
        const nextNote =
          restUpdates.note !== undefined ? restUpdates.note : activity.note;
        const nextOrderIndex =
          restUpdates.orderIndex !== undefined
            ? restUpdates.orderIndex
            : activity.orderIndex;

        if (
          activity.bucket === nextBucket &&
          activity.date === nextDate &&
          activity.time === nextTime &&
          activity.durationMinutes === nextDuration &&
          activity.repeat === nextRepeat &&
          activity.title === nextTitle &&
          activity.note === nextNote &&
          activity.isDone === nextIsDone &&
          activity.orderIndex === nextOrderIndex
        ) {
          return activity;
        }

        modified = true;
        return {
          ...activity,
          bucket: nextBucket,
          date: nextDate,
          time: nextTime,
          durationMinutes: nextDuration,
          repeat: nextRepeat,
          title: nextTitle,
          note: nextNote,
          isDone: nextIsDone,
          orderIndex: nextOrderIndex,
          updatedAt: now,
        };
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
      const now = nowIsoString();
      let changed = false;
      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }
        if (activity.isDone) {
          return activity;
        }
        const needsUpdate =
          activity.bucket !== "inbox" ||
          activity.date !== null ||
          activity.time !== null;
        if (!needsUpdate) {
          return activity;
        }
        changed = true;
        return {
          ...activity,
          bucket: "inbox",
          date: null,
          time: null,
          durationMinutes: null,
          repeat: "none",
          updatedAt: now,
        };
      });
      return changed ? { activities } : state;
    });
  },

  moveToLater: (id) => {
    set((state) => {
      const now = nowIsoString();
      let changed = false;
      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }
        if (activity.isDone) {
          return activity;
        }
        const needsUpdate =
          activity.bucket !== "later" ||
          activity.date !== null ||
          activity.time !== null;
        if (!needsUpdate) {
          return activity;
        }
        changed = true;
        return {
          ...activity,
          bucket: "later",
          date: null,
          time: null,
          durationMinutes: null,
          repeat: "none",
          updatedAt: now,
        };
      });
      return changed ? { activities } : state;
    });
  },

  scheduleActivity: (id, date) => {
    set((state) => {
      const now = nowIsoString();
      let changed = false;
      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }
        if (activity.bucket === "scheduled" && activity.date === date) {
          return activity;
        }
        changed = true;
        return {
          ...activity,
          bucket: "scheduled",
          date,
          updatedAt: now,
        };
      });
      return changed ? { activities } : state;
    });
  },

  unscheduleToInbox: (id) => {
    set((state) => {
      const now = nowIsoString();
      let changed = false;
      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }
        if (activity.isDone) {
          return activity;
        }
        const needsUpdate =
          activity.bucket !== "inbox" ||
          activity.date !== null ||
          activity.time !== null;
        if (!needsUpdate) {
          return activity;
        }
        changed = true;
        return {
          ...activity,
          bucket: "inbox",
          date: null,
          time: null,
          durationMinutes: null,
          repeat: "none",
          updatedAt: now,
        };
      });
      return changed ? { activities } : state;
    });
  },

  setTime: (id, time, durationMinutes, repeat) => {
    set((state) => {
      const now = nowIsoString();
      let changed = false;
      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }

        const anchored = isScheduledWithTime(activity.bucket, time);
        const nextTime = anchored ? time : null;

        const rawDuration =
          durationMinutes !== undefined
            ? durationMinutes
            : activity.durationMinutes;
        const nextDuration = anchored
          ? normalizeDurationMinutes(rawDuration)
          : null;

        const rawRepeat = repeat ?? activity.repeat;
        const nextRepeat = anchored ? normalizeRepeat(rawRepeat) : "none";

        if (
          activity.time === nextTime &&
          activity.durationMinutes === nextDuration &&
          activity.repeat === nextRepeat
        ) {
          return activity;
        }

        changed = true;
        return {
          ...activity,
          time: nextTime,
          durationMinutes: nextDuration,
          repeat: nextRepeat,
          updatedAt: now,
        };
      });
      return changed ? { activities } : state;
    });
  },

  toggleDone: (id) => {
    set((state) => {
      const now = nowIsoString();
      const today = todayIsoDate();
      let changed = false;

      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }

        const nextIsDone = !activity.isDone;
        const shouldScheduleToday =
          nextIsDone && (activity.bucket === "inbox" || activity.bucket === "later");

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
          bucket: "scheduled",
          date: today,
          time: null,
          durationMinutes: null,
          repeat: "none",
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

      const now = nowIsoString();
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

      const now = nowIsoString();
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
    clearPersistedState();
    set({
      activities: getDefaultActivities(),
      lists: getDefaultListsState(),
      settings: getDefaultSettings(),
    });
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Selectors (exported for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export const getInboxActivities = (activities: Activity[]): Activity[] =>
  activities
    .filter((activity) => activity.bucket === "inbox")
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
    .filter((activity) => activity.bucket === "later")
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

export const getActivitiesForDate = (
  activities: Activity[],
  date: string
): Activity[] =>
  activities.filter(
    (activity) => isScheduled(activity) && activity.date === date
  );

const getWeekDates = (weekStartDate: string): string[] => {
  const start = new Date(`${weekStartDate}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, dayOffset) => {
    const nextDate = new Date(start);
    nextDate.setUTCDate(start.getUTCDate() + dayOffset);
    return nextDate.toISOString().slice(0, 10);
  });
};

export const getActivitiesForWeek = (
  activities: Activity[],
  weekStartDate: string
): Record<string, Activity[]> => {
  const dates = getWeekDates(weekStartDate);
  return dates.reduce<Record<string, Activity[]>>((acc, date) => {
    acc[date] = getActivitiesForDate(activities, date);
    return acc;
  }, {} as Record<string, Activity[]>);
};

// ─────────────────────────────────────────────────────────────────────────────
// Persistence Subscription Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a persisted state object from the current store state.
 */
export function createPersistedStateFromStore(): PersistedState {
  const state = useHakuStore.getState();
  return {
    version: CURRENT_SCHEMA_VERSION,
    activities: state.activities,
    lists: state.lists,
    settings: state.settings,
  };
}
