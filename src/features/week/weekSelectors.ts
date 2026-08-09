import { compareActivitiesByTime, isScheduled, type Activity } from '@/shared/types/activity';
import { getCalendarWeekDates, getCalendarWeekStart } from '@/shared/utils/calendarDate';

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
  return getCalendarWeekStart(isoDate, weekStartsOn);
};

export const getWeekDates = getCalendarWeekDates;

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
