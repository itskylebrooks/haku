import type React from "react";
import { Circle, CheckCircle2 } from "lucide-react";
import type { Activity, RepeatPattern } from "../../shared/types/activity";

interface ActivityCardProps {
  activity: Activity;
  onToggleDone: (id: string) => void;
  onEdit: (activity: Activity) => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onTouchStart?: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove?: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<HTMLDivElement>) => void;
  disableHover?: boolean;
  forceHover?: boolean;
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
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  disableHover = false,
  forceHover = false,
}: ActivityCardProps) => {
  const { id, title, time, durationMinutes, repeat, note, isDone } = activity;

  const hasMetaRow = time !== null;
  const repeatLabel = getRepeatLabel(repeat);
  const hoverClasses = !disableHover && !isDone
    ? "hover:bg-[var(--color-card-hover)] hover:shadow-sm"
    : "";
  const activeHoverClasses = forceHover && !isDone
    ? "bg-[var(--color-card-hover)] shadow-sm"
    : "";

  return (
    <div
      className={`group flex cursor-pointer rounded-md transition select-none ${
        isDone ? "" : hoverClasses
      } ${activeHoverClasses} ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-50" : ""}`}
      style={{ WebkitTouchCallout: "none" }}
      onClick={() => onEdit(activity)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Content block - click anywhere here to edit */}
      <div className="flex-1 pl-2 pr-3 py-3 md:pl-2 md:pr-4 md:py-2.5">
        {/* Meta row: time + metadata */}
        {hasMetaRow && (
          <div className="mb-1 flex items-center gap-1 text-xs md:text-[0.7rem]">
            <span
              className={`${
                isDone
                  ? "text-[var(--color-text-faint)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              {formatTimeWithAmPm(time)}
            </span>
            {durationMinutes !== null && (
              <>
                <span className="text-[var(--color-text-faint)]">•</span>
                <span
                  className={`${
                    isDone
                      ? "text-[var(--color-text-faint)]"
                      : "text-[var(--color-text-meta)]"
                  }`}
                >
                  {formatDuration(durationMinutes)}
                </span>
              </>
            )}
            {repeatLabel && (
              <>
                <span className="text-[var(--color-text-faint)]">•</span>
                <span
                  className={`${
                    isDone
                      ? "text-[var(--color-text-faint)]"
                      : "text-[var(--color-text-meta)]"
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
          className={`text-sm font-semibold leading-snug md:text-sm ${
            isDone
              ? "text-[var(--color-text-faint)] line-through decoration-[var(--color-strike)]"
              : "text-[var(--color-text-primary)]"
          }`}
        >
          {title}
        </h3>

        {/* Note - allow wrapping, no truncation */}
        {note && (
          <p
            className={`mt-1 text-xs leading-relaxed md:text-xs ${
              isDone
                ? "text-[var(--color-text-faint)]"
                : "text-[var(--color-text-subtle)]"
            }`}
          >
            {note}
          </p>
        )}
      </div>

      {/* Right: Check circle gutter - vertically centered */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleDone(id);
        }}
        className="flex w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-r-md transition hover:bg-[var(--color-card-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--color-border)] md:w-11"
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
      >
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--color-text-faint)]" />
        ) : (
          <Circle className="h-5 w-5 text-[var(--color-text-meta)]" />
        )}
      </button>
    </div>
  );
};

export default ActivityCard;
