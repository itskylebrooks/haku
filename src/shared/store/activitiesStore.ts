import { create } from "zustand";
import {
  hasDuration,
  isAnchored,
  isScheduled,
} from "../types/activity";
import type { Activity, Bucket } from "../types/activity";

type AddActivityInput = {
  title: string;
  bucket?: Bucket;
  date?: string | null;
  time?: string | null;
  durationMinutes?: number | null;
  note?: string | null;
};

export interface ActivitiesState {
  activities: Activity[];
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
  setTime: (id: string, time: string | null, durationMinutes?: number | null) => void;
  toggleDone: (id: string) => void;
  reorderInDay: (date: string, orderedIds: string[]) => void;
}

const generateActivityId = (() => {
  let counter = 0;
  return () => `activity_${Date.now()}_${counter++}`;
})();

const nowIsoString = () => new Date().toISOString();

export const useActivitiesStore = create<ActivitiesState>((set) => ({
  activities: [],
  addActivity: (input) => {
    const title = input.title.trim();
    const bucket = input.bucket ?? "inbox";
    const now = nowIsoString();

    const newActivity: Activity = {
      id: generateActivityId(),
      title,
      bucket,
      date: bucket === "scheduled" ? input.date ?? null : null,
      time: bucket === "scheduled" ? input.time ?? null : null,
      durationMinutes: input.durationMinutes ?? null,
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
      let modified = false;
      const now = nowIsoString();
      const { updatedAt: _ignoredUpdatedAt, ...restUpdates } = updates;

      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }

        modified = true;
        return {
          ...activity,
          ...restUpdates,
          createdAt: activity.createdAt,
          id: activity.id,
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
          updatedAt: now,
        };
      });
      return changed ? { activities } : state;
    });
  },
  setTime: (id, time, durationMinutes) => {
    set((state) => {
      const now = nowIsoString();
      let changed = false;
      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }

        let nextTime = time;
        let nextDuration = activity.durationMinutes;

        if (time === null) {
          nextTime = null;
          nextDuration = null;
        } else if (durationMinutes !== undefined) {
          nextDuration = durationMinutes;
        }

        const durationMatches =
          nextDuration === activity.durationMinutes ||
          (nextDuration === null && !hasDuration(activity));

        if (activity.time === nextTime && durationMatches) {
          return activity;
        }

        changed = true;
        return {
          ...activity,
          time: nextTime,
          durationMinutes: nextDuration,
          updatedAt: now,
        };
      });
      return changed ? { activities } : state;
    });
  },
  toggleDone: (id) => {
    set((state) => {
      const now = nowIsoString();
      let changed = false;
      const activities = state.activities.map((activity): Activity => {
        if (activity.id !== id) {
          return activity;
        }
        changed = true;
        return {
          ...activity,
          isDone: !activity.isDone,
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
        if (activity.date !== date || isAnchored(activity)) {
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
}));

export const getInboxActivities = (activities: Activity[]): Activity[] =>
  activities
    .filter((activity) => activity.bucket === "inbox")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const getLaterActivities = (activities: Activity[]): Activity[] =>
  activities
    .filter((activity) => activity.bucket === "later")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

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
