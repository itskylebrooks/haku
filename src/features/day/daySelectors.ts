import { compareActivitiesByTime, type Activity } from '@/shared/types/activity';

export interface DayViewData {
  overdue: Activity[];
  todayAnchored: Activity[];
  todayFlexible: Activity[];
}

/**
 * Compare activities for sorting in the overdue section.
 * Sort by date ascending, then by time (if both have time), then by createdAt.
 */
const compareOverdueActivities = (a: Activity, b: Activity): number => {
  // First, compare by date
  if (a.date !== null && b.date !== null && a.date !== b.date) {
    return a.date.localeCompare(b.date);
  }

  // Then, compare by time if both have time
  if (a.time !== null && b.time !== null) {
    const timeComparison = a.time.localeCompare(b.time);
    if (timeComparison !== 0) {
      return timeComparison;
    }
  } else if (a.time !== null) {
    return -1;
  } else if (b.time !== null) {
    return 1;
  }

  // Finally, compare by createdAt
  return a.createdAt.localeCompare(b.createdAt);
};

/**
 * Compare flexible activities for sorting.
 * Sort by orderIndex if present, otherwise by createdAt.
 */
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

/**
 * Prepares data for the Day view by selecting and sorting activities.
 *
 * @param activities - All activities from the store
 * @param activeDate - The currently selected date in YYYY-MM-DD format
 * @returns Object containing overdue, todayAnchored, and todayFlexible arrays
 */
export const getDayViewData = (activities: Activity[], activeDate: string): DayViewData => {
  const overdue: Activity[] = [];
  const todayAnchored: Activity[] = [];
  const todayFlexible: Activity[] = [];

  for (const activity of activities) {
    // Only consider scheduled activities
    if (activity.bucket !== 'scheduled' || activity.date === null) {
      continue;
    }

    // Overdue: scheduled, date < activeDate, not done
    if (activity.date < activeDate && !activity.isDone) {
      overdue.push(activity);
      continue;
    }

    // Today: scheduled, date === activeDate
    if (activity.date === activeDate) {
      if (activity.time !== null) {
        todayAnchored.push(activity);
      } else {
        todayFlexible.push(activity);
      }
    }
  }

  // Sort overdue by date, then time, then createdAt
  overdue.sort(compareOverdueActivities);

  // Sort anchored by time
  todayAnchored.sort(compareActivitiesByTime);

  // Sort flexible by orderIndex, then createdAt
  todayFlexible.sort(compareFlexibleActivities);

  return {
    overdue,
    todayAnchored,
    todayFlexible,
  };
};
