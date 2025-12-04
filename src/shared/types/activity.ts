/**
 * Buckets that represent where an activity currently lives.
 */
export type Bucket = "inbox" | "later" | "scheduled";

/**
 * Core domain entity describing a single piece of work (task or event) in Haku.
 */
export interface Activity {
  /**
   * Unique identifier for the activity (e.g. UUID or nanoid).
   */
  id: string;
  /**
   * Short description that names the activity; always required.
   */
  title: string;
  /**
   * Indicates whether the activity is captured, deferred, or scheduled.
   */
  bucket: Bucket;
  /**
   * ISO date (YYYY-MM-DD) for scheduled items; null for inbox or later entries.
   */
  date: string | null;
  /**
   * Optional 24h start time (HH:MM). Non-null marks the activity as anchored.
   */
  time: string | null;
  /**
   * Optional duration stored as whole minutes. Null when unknown or unused.
   */
  durationMinutes: number | null;
  /**
   * Longer free-text note associated with the activity.
   */
  note: string | null;
  /**
   * Flag showing whether the activity has been completed.
   */
  isDone: boolean;
  /**
   * Optional per-day ordering hint for flexible (no time) activities.
   */
  orderIndex: number | null;
  /**
   * ISO timestamp for when the activity was created.
   */
  createdAt: string;
  /**
   * ISO timestamp for the most recent update to the activity.
   */
  updatedAt: string;
}

/**
 * Returns true when the activity has a start time, meaning it is anchored.
 */
export const isAnchored = (activity: Activity): boolean => activity.time !== null;

/**
 * Determines whether the activity is scheduled for a specific date.
 */
export const isScheduled = (activity: Activity): boolean =>
  activity.bucket === "scheduled" && activity.date !== null;

/**
 * Indicates that the activity carries a positive duration in minutes.
 */
export const hasDuration = (activity: Activity): boolean =>
  activity.durationMinutes !== null && activity.durationMinutes > 0;

/**
 * Comparison utility that sorts anchored activities by time and places flexible ones after.
 */
export const compareActivitiesByTime = (a: Activity, b: Activity): number => {
  if (a.time === null && b.time === null) {
    return 0;
  }
  if (a.time === null) {
    return 1;
  }
  if (b.time === null) {
    return -1;
  }

  return a.time.localeCompare(b.time);
};
