import type { Activity } from "../types/activity";

export const DRAG_PLACEHOLDER_ID = "__DRAG_PLACEHOLDER__";

const clampIndex = (targetIndex: number, maxLength: number) =>
  Math.min(Math.max(targetIndex, 0), maxLength);

const applyAnchoredOrdering = (merged: Activity[]): Activity[] => {
  const anchored = merged
    .filter((item) => item.time !== null)
    .sort((a, b) => {
      if (a.time === null || b.time === null) return 0;
      return a.time.localeCompare(b.time);
    });

  let anchoredPtr = 0;
  return merged.map((item) => {
    if (item.time !== null) {
      return anchored[anchoredPtr++];
    }
    return item;
  });
};

/**
 * Reorders a list with the dragged activity in-place, keeping anchored items
 * sorted by time while flexible items can move freely.
 */
export const computeAnchoredPreviewOrder = (
  activities: Activity[],
  draggedId: string,
  targetIndex: number
): Activity[] => {
  const dragged = activities.find((a) => a.id === draggedId);
  if (!dragged) return activities;

  const withoutDragged = activities.filter((a) => a.id !== draggedId);
  const clampedIndex = clampIndex(targetIndex, withoutDragged.length);

  const merged = [
    ...withoutDragged.slice(0, clampedIndex),
    dragged,
    ...withoutDragged.slice(clampedIndex),
  ];

  return applyAnchoredOrdering(merged);
};

/**
 * Builds a preview list that shows a placeholder gap at the drop target while
 * anchored items remain sorted by time.
 */
export const computePlaceholderPreview = (
  activities: Activity[],
  draggedActivity: Activity,
  targetIndex: number
): Activity[] => {
  const withoutDragged = activities.filter((a) => a.id !== draggedActivity.id);
  const clampedIndex = clampIndex(targetIndex, withoutDragged.length);

  const placeholder: Activity = {
    ...draggedActivity,
    id: DRAG_PLACEHOLDER_ID,
  };

  const merged = [
    ...withoutDragged.slice(0, clampedIndex),
    placeholder,
    ...withoutDragged.slice(clampedIndex),
  ];

  return applyAnchoredOrdering(merged);
};
