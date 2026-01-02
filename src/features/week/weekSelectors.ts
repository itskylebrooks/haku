import { compareActivitiesByTime, isScheduled, type Activity } from '@/shared/types/activity';

export type WeekActivities = Record<string, Activity[]>;

const compareFlexibleActivities = (a: Activity, b: Activity): number => {
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
};

export const getWeekStartDate = (
  isoDate: string,
  weekStartsOn: 'monday' | 'sunday' = 'monday',
): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  const dayOfWeek = date.getUTCDay(); // Sunday = 0, Monday = 1
  const offset = weekStartsOn === 'sunday' ? dayOfWeek : (dayOfWeek + 6) % 7; // Monday as start

  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};

export const getWeekDates = (weekStartDate: string): string[] => {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    return [];
  }

  return Array.from({ length: 7 }, (_, dayOffset) => {
    const nextDate = new Date(start);
    nextDate.setUTCDate(start.getUTCDate() + dayOffset);
    return nextDate.toISOString().slice(0, 10);
  });
};

export const getWeekActivities = (
  activities: Activity[],
  weekStartDate: string,
): WeekActivities => {
  const dates = getWeekDates(weekStartDate);
  if (dates.length === 0) {
    return {};
  }

  const dateSet = new Set(dates);
  const grouped: WeekActivities = {};
  dates.forEach((date) => {
    grouped[date] = [];
  });

  for (const activity of activities) {
    if (!isScheduled(activity) || activity.date === null) {
      continue;
    }
    if (!dateSet.has(activity.date)) {
      continue;
    }
    grouped[activity.date].push(activity);
  }

  Object.keys(grouped).forEach((date) => {
    const items = grouped[date];
    const anyOrderIndex = items.some((item) => item.orderIndex !== null);

    if (anyOrderIndex) {
      grouped[date] = [...items].sort((a, b) => {
        if (a.orderIndex !== null && b.orderIndex !== null) {
          return a.orderIndex - b.orderIndex;
        }
        if (a.orderIndex !== null) return -1;
        if (b.orderIndex !== null) return 1;

        if (a.time !== null && b.time !== null) {
          return compareActivitiesByTime(a, b);
        }
        if (a.time !== null && b.time === null) return 1;
        if (a.time === null && b.time !== null) return -1;
        return a.createdAt.localeCompare(b.createdAt);
      });
      return;
    }

    const anchored = items
      .filter((activity) => activity.time !== null)
      .sort(compareActivitiesByTime);
    const flexible = items
      .filter((activity) => activity.time === null)
      .sort(compareFlexibleActivities);

    grouped[date] = [...flexible, ...anchored];
  });

  return grouped;
};
