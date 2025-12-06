import type React from "react";
import { Circle, CheckCircle2 } from "lucide-react";
import type { Activity, RepeatPattern } from "../../shared/types/activity";

interface WeekActivityRowProps {
  activity: Activity;
  onToggleDone: (id: string) => void;
  onEdit: (activity: Activity) => void;
}

const formatTimeWithAmPm = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
};

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

const WeekActivityRow = ({ activity, onToggleDone, onEdit }: WeekActivityRowProps) => {
  const { id, title, time, durationMinutes, repeat, isDone } = activity;

  const repeatLabel = getRepeatLabel(repeat);
  const metaParts: string[] = [];
  if (time) {
    metaParts.push(formatTimeWithAmPm(time));
  }
  if (durationMinutes !== null) {
    metaParts.push(formatDuration(durationMinutes));
  }
  if (repeatLabel) {
    metaParts.push(repeatLabel);
  }

  const hasMeta = metaParts.length > 0;

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleDone(id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEdit(activity);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(activity)}
      onKeyDown={handleKeyDown}
      className={`group flex items-stretch rounded-lg px-1.5 py-1 transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] ${
        isDone ? "bg-transparent" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center">
          <p
            className={`flex-1 min-w-0 line-clamp-1 text-[13px] font-semibold leading-tight ${
              isDone
                ? "text-[var(--color-text-faint)] line-through decoration-[var(--color-strike)]"
                : "text-[var(--color-text-primary)]"
            }`}
          >
            {title}
          </p>
        </div>

        {hasMeta && (
          <p
            className={`mt-0 text-[10px] leading-snug ${
              isDone ? "text-[var(--color-text-faint)]" : "text-[var(--color-text-subtle)]"
            }`}
          >
            {metaParts.join(" · ")}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleToggle}
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
        className="ml-auto -mr-1.5 -my-1 flex flex-shrink-0 items-center justify-center pr-3 pl-3 rounded-r-lg text-[var(--color-text-meta)] transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
      >
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--color-text-faint)]" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>
    </div>
  );
};

export default WeekActivityRow;
