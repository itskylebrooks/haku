import { Circle, CheckCircle2, EllipsisVertical } from "lucide-react";
import type { Activity, RepeatPattern } from "../../shared/types/activity";

interface ActivityCardProps {
  activity: Activity;
  onToggleDone: (id: string) => void;
  onEdit: (activity: Activity) => void;
}

/**
 * Formats time in HH:MM format to HH:MM AM/PM.
 */
const formatTimeWithAmPm = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
};

/**
 * Formats duration in minutes to a human-readable string.
 */
const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} h ${remainingMinutes} min`;
  }
  if (hours > 0) {
    return `${hours} h`;
  }
  return `${remainingMinutes} min`;
};

/**
 * Returns the display label for a repeat pattern.
 */
const getRepeatLabel = (repeat: RepeatPattern): string | null => {
  switch (repeat) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    default:
      return null;
  }
};

const ActivityCard = ({
  activity,
  onToggleDone,
  onEdit,
}: ActivityCardProps) => {
  const { id, title, time, durationMinutes, repeat, note, isDone } = activity;

  const hasMetaRow = time !== null;
  const repeatLabel = getRepeatLabel(repeat);

  return (
    <div
      className={`group flex rounded-xl transition ${
        isDone
          ? ""
          : "hover:bg-neutral-100 hover:shadow-sm dark:hover:bg-neutral-800/50 dark:hover:shadow-sm"
      }`}
    >
      {/* Left: Edit button column - always visible, rounded left corners */}
      <button
        type="button"
        onClick={() => onEdit(activity)}
        className={`flex w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-l-xl transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-neutral-200 dark:hover:bg-neutral-800 dark:focus-visible:outline-neutral-700 md:w-8 ${
          isDone ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-600 dark:text-neutral-400"
        }`}
        aria-label="Edit activity"
      >
        <EllipsisVertical className="h-5 w-5" />
      </button>

      {/* Middle: Content block */}
      <div className="flex-1 px-3 py-3 md:px-4 md:py-3">
        {/* Meta row: time + metadata */}
        {hasMetaRow && (
          <div className="mb-2 flex items-center gap-1 text-xs">
            <span
              className={`${
                isDone
                  ? "text-neutral-400 dark:text-neutral-500"
                  : "text-gray-700 dark:text-gray-100"
              }`}
            >
              {formatTimeWithAmPm(time)}
            </span>
            {durationMinutes !== null && (
              <>
                <span className="text-neutral-400 dark:text-neutral-500">•</span>
                <span
                  className={`${
                    isDone
                      ? "text-neutral-400 dark:text-neutral-500"
                      : "text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  {formatDuration(durationMinutes)}
                </span>
              </>
            )}
            {repeatLabel && (
              <>
                <span className="text-neutral-400 dark:text-neutral-500">•</span>
                <span
                  className={`${
                    isDone
                      ? "text-neutral-400 dark:text-neutral-500"
                      : "text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  {repeatLabel}
                </span>
              </>
            )}
          </div>
        )}

        {/* Title - allow wrapping, no truncation */}
        <h3
          className={`text-sm font-semibold leading-snug md:text-base ${
            isDone
              ? "text-neutral-400 line-through decoration-neutral-400/50 dark:text-neutral-500 dark:decoration-neutral-500/50"
              : "text-neutral-900 dark:text-neutral-100"
          }`}
        >
          {title}
        </h3>

        {/* Note - allow wrapping, no truncation */}
        {note && (
          <p
            className={`mt-1 text-xs leading-relaxed md:text-sm ${
              isDone
                ? "text-neutral-400 dark:text-neutral-500"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            {note}
          </p>
        )}
      </div>

      {/* Right: Check circle gutter - vertically centered */}
      <button
        type="button"
        onClick={() => onToggleDone(id)}
        className={`flex w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-r-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-neutral-200 dark:focus-visible:outline-neutral-700 md:w-11 ${
          isDone
            ? "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
        }`}
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
      >
        {isDone ? (
          <CheckCircle2 className="h-6 w-6 text-neutral-400 dark:text-neutral-500 md:h-7 md:w-7" />
        ) : (
          <Circle className="h-6 w-6 text-neutral-600 dark:text-neutral-400 md:h-7 md:w-7" />
        )}
      </button>
    </div>
  );
};

export default ActivityCard;
