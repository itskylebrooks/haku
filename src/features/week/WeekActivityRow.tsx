import type React from "react";
import { Circle, CheckCircle2 } from "lucide-react";
import type { Activity } from "../../shared/types/activity";

interface WeekActivityRowProps {
  activity: Activity;
  onToggleDone: (id: string) => void;
  onEdit: (activity: Activity) => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  disableHover?: boolean;
  showNote?: boolean;
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



const WeekActivityRow = ({
  activity,
  onToggleDone,
  onEdit,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  disableHover = false,
  showNote = false,
}: WeekActivityRowProps) => {
  const { id, title, time, durationMinutes, note, isDone } = activity;

  const metaParts: string[] = [];
  if (time) {
    metaParts.push(formatTimeWithAmPm(time));
  }
  if (durationMinutes !== null) {
    metaParts.push(formatDuration(durationMinutes));
  }

  const hasMeta = metaParts.length > 0;
  const hasVisibleNote = showNote && Boolean(note);
  const centerTitleOnly = !hasMeta && !hasVisibleNote;

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

  const hoverClasses = !disableHover && !isDone
    ? "hover:bg-[var(--color-surface-hover)]"
    : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(activity)}
      onKeyDown={handleKeyDown}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group flex min-h-[38px] items-stretch rounded-lg px-1.5 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] ${isDone ? "bg-transparent" : ""
        } ${hoverClasses} ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-50" : ""}`}
    >
      <div
        className={`flex min-w-0 flex-1 flex-col ${centerTitleOnly ? "justify-center" : ""
          }`}
      >
        <div className="flex min-w-0 items-center">
          <p
            className={`flex-1 min-w-0 truncate text-[13px] font-semibold leading-tight ${isDone
              ? "text-[var(--color-text-faint)] line-through decoration-[var(--color-strike)]"
              : "text-[var(--color-text-primary)]"
              }`}
          >
            {title}
          </p>
        </div>

        <p
          className={`mt-0 text-[10px] leading-snug h-3.5 ${isDone ? "text-[var(--color-text-faint)]" : "text-[var(--color-text-subtle)]"
            } ${hasMeta ? "" : "hidden"}`}
        >
          {hasMeta ? metaParts.join(" · ") : " "}
        </p>
        {showNote && note && (
          <p
            className={`mt-1 text-[11px] leading-snug ${isDone ? "text-[var(--color-text-faint)] line-through decoration-[var(--color-strike)]" : "text-[var(--color-text-subtle)]"
              }`}
          >
            {note}
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
