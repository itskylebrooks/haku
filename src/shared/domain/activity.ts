import type { Activity, Bucket } from '../types/activity';
import { isCalendarDate } from '../utils/calendarDate';

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type NewActivityInput = {
  title: string;
  bucket?: Bucket;
  date?: string | null;
  time?: string | null;
  durationMinutes?: number | null;
  note?: string | null;
};

export type ActivityDestination =
  | { bucket: 'scheduled'; date: string }
  | { bucket: 'inbox' | 'later' };

export interface MoveActivityInput {
  activityId: string;
  destination: ActivityDestination;
  destinationOrderedIds: string[];
  sourceOrderedIds?: string[];
}

type ActivityPlacement = Pick<Activity, 'bucket' | 'date' | 'time' | 'durationMinutes'>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export const isActivityTime = (value: unknown): value is string =>
  typeof value === 'string' && TIME_PATTERN.test(value);

export const isActivityDuration = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 15 &&
  value <= 300 &&
  value % 15 === 0;

export const normalizeActivityDuration = (value?: number | null): number | null =>
  isActivityDuration(value) ? value : null;

export const normalizeActivityPlacement = (
  bucket: Bucket,
  date: string | null | undefined,
  time: string | null | undefined,
  durationMinutes: number | null | undefined,
  fallbackDate: string,
): ActivityPlacement => {
  if (bucket !== 'scheduled') {
    return { bucket, date: null, time: null, durationMinutes: null };
  }

  const normalizedDate = isCalendarDate(date) ? date : fallbackDate;
  const normalizedTime = isActivityTime(time) ? time : null;

  return {
    bucket,
    date: normalizedDate,
    time: normalizedTime,
    durationMinutes: normalizedTime === null ? null : normalizeActivityDuration(durationMinutes),
  };
};

export const createActivityEntity = (
  input: NewActivityInput,
  context: { id: string; now: string; today: string },
): Activity => {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Activity title is required');
  }

  const placement = normalizeActivityPlacement(
    input.bucket ?? 'inbox',
    input.date,
    input.time,
    input.durationMinutes,
    context.today,
  );

  return {
    id: context.id,
    title,
    ...placement,
    note: input.note ?? null,
    isDone: false,
    orderIndex: null,
    createdAt: context.now,
    updatedAt: context.now,
  };
};

export const updateActivityEntity = (
  activity: Activity,
  updates: Partial<Omit<Activity, 'id' | 'createdAt'>>,
  context: { now: string; today: string },
): Activity => {
  const requestedBucket = updates.bucket ?? activity.bucket;
  const isDone = updates.isDone ?? activity.isDone;
  const bucket = isDone && requestedBucket !== 'scheduled' ? 'scheduled' : requestedBucket;
  const requestedDate = updates.date ?? activity.date;
  const fallbackDate = isCalendarDate(activity.date) ? activity.date : context.today;
  const placement = normalizeActivityPlacement(
    bucket,
    requestedDate,
    updates.time === undefined ? activity.time : updates.time,
    updates.durationMinutes === undefined ? activity.durationMinutes : updates.durationMinutes,
    fallbackDate,
  );

  const requestedTitle = updates.title === undefined ? activity.title : updates.title.trim();
  const title = requestedTitle || activity.title;
  const note = updates.note === undefined ? activity.note : updates.note;
  const requestedOrderIndex =
    updates.orderIndex === undefined ? activity.orderIndex : updates.orderIndex;
  const orderIndex =
    requestedOrderIndex === null ||
    (Number.isInteger(requestedOrderIndex) && requestedOrderIndex >= 0)
      ? requestedOrderIndex
      : null;

  if (
    activity.title === title &&
    activity.bucket === placement.bucket &&
    activity.date === placement.date &&
    activity.time === placement.time &&
    activity.durationMinutes === placement.durationMinutes &&
    activity.note === note &&
    activity.isDone === isDone &&
    activity.orderIndex === orderIndex
  ) {
    return activity;
  }

  return {
    ...activity,
    title,
    ...placement,
    note,
    isDone,
    orderIndex,
    updatedAt: context.now,
  };
};

const createOrderMap = (ids: string[]): Map<string, number> => {
  const uniqueIds = [...new Set(ids)];
  return new Map(uniqueIds.map((id, index) => [id, index]));
};

const isInSameLocation = (left: Activity, right: Activity): boolean => {
  if (left.bucket !== right.bucket) return false;
  return left.bucket !== 'scheduled' || left.date === right.date;
};

const isInDestination = (activity: Activity, destination: ActivityDestination): boolean =>
  activity.bucket === destination.bucket &&
  (destination.bucket !== 'scheduled' || activity.date === destination.date);

/** Applies a location change and both affected orderings as one pure transaction. */
export const moveActivityInCollection = (
  activities: Activity[],
  input: MoveActivityInput,
  context: { now: string; today: string },
): Activity[] => {
  const movingActivity = activities.find(({ id }) => id === input.activityId);
  if (!movingActivity) return activities;
  if (movingActivity.isDone && input.destination.bucket !== 'scheduled') return activities;

  const destinationIds = input.destinationOrderedIds.includes(input.activityId)
    ? input.destinationOrderedIds
    : [...input.destinationOrderedIds, input.activityId];
  const destinationOrder = createOrderMap(destinationIds);
  const sourceOrder = createOrderMap(input.sourceOrderedIds ?? []);
  const placement = normalizeActivityPlacement(
    input.destination.bucket,
    input.destination.bucket === 'scheduled' ? input.destination.date : null,
    movingActivity.time,
    movingActivity.durationMinutes,
    context.today,
  );

  let changed = false;
  const nextActivities = activities.map((activity): Activity => {
    const isMoving = activity.id === movingActivity.id;
    const destinationIndex = destinationOrder.get(activity.id);
    const sourceIndex = sourceOrder.get(activity.id);
    const nextOrderIndex =
      destinationIndex !== undefined && (isMoving || isInDestination(activity, input.destination))
        ? destinationIndex
        : sourceIndex !== undefined && isInSameLocation(activity, movingActivity)
          ? sourceIndex
          : activity.orderIndex;

    const nextPlacement = isMoving
      ? placement
      : {
          bucket: activity.bucket,
          date: activity.date,
          time: activity.time,
          durationMinutes: activity.durationMinutes,
        };

    if (
      activity.bucket === nextPlacement.bucket &&
      activity.date === nextPlacement.date &&
      activity.time === nextPlacement.time &&
      activity.durationMinutes === nextPlacement.durationMinutes &&
      activity.orderIndex === nextOrderIndex
    ) {
      return activity;
    }

    changed = true;
    return {
      ...activity,
      ...nextPlacement,
      orderIndex: nextOrderIndex,
      updatedAt: context.now,
    };
  });

  return changed ? nextActivities : activities;
};

export const isPersistedActivity = (value: unknown): value is Activity => {
  if (!isObject(value)) return false;

  const bucket = value.bucket;
  if (bucket !== 'inbox' && bucket !== 'later' && bucket !== 'scheduled') return false;
  if (typeof value.id !== 'string' || value.id.trim() === '') return false;
  if (typeof value.title !== 'string' || value.title.trim() === '') return false;
  if (value.note !== null && typeof value.note !== 'string') return false;
  if (typeof value.isDone !== 'boolean') return false;
  if (
    value.orderIndex !== null &&
    (!Number.isInteger(value.orderIndex) || (value.orderIndex as number) < 0)
  ) {
    return false;
  }
  if (!isIsoTimestamp(value.createdAt) || !isIsoTimestamp(value.updatedAt)) return false;

  if (bucket !== 'scheduled') {
    return (
      value.date === null &&
      value.time === null &&
      value.durationMinutes === null &&
      value.isDone === false
    );
  }

  if (!isCalendarDate(value.date)) return false;
  if (value.time !== null && !isActivityTime(value.time)) return false;
  if (value.time === null) return value.durationMinutes === null;
  return value.durationMinutes === null || isActivityDuration(value.durationMinutes);
};

export const isPersistedActivityCollection = (value: unknown): value is Activity[] => {
  if (!Array.isArray(value) || !value.every(isPersistedActivity)) return false;
  return new Set(value.map(({ id }) => id)).size === value.length;
};
