import type { Activity } from "@/shared/types/activity";

/**
 * Distributes activities into two columns with the following rules:
 * 1. Each column has a fixed height of 5 items
 * 2. Fill the first column top-down before moving to the second column
 * 3. The bottom-right cell (last cell of second column) is always reserved for an "Add activity" slot
 * 4. If there are fewer items than can fit, the empty slots are in the second column
 *
 * @param activities - The activities to distribute
 * @returns A tuple of [firstColumnActivities, secondColumnActivities]
 */
export const distributeIntoTwoColumns = (
  activities: Activity[]
): [Activity[], Activity[]] => {
  const COLUMN_HEIGHT = 5;
  const maxItems = COLUMN_HEIGHT * 2 - 1; // 9 items max (one slot reserved for "Add")

  if (activities.length === 0) {
    return [[], []];
  }

  if (activities.length <= COLUMN_HEIGHT) {
    // All items fit in first column
    return [activities, []];
  }

  if (activities.length <= maxItems) {
    // First column is full, remaining in second column
    return [
      activities.slice(0, COLUMN_HEIGHT),
      activities.slice(COLUMN_HEIGHT),
    ];
  }

  // More than maxItems: only show maxItems (rest are beyond the UI capacity)
  return [
    activities.slice(0, COLUMN_HEIGHT),
    activities.slice(COLUMN_HEIGHT, maxItems),
  ];
};
