import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Inbox,
  Settings,
  Square,
} from "lucide-react";
import { useMemo } from "react";

type ViewMode = "day" | "week";

interface DesktopHeaderProps {
  mode: ViewMode;
  currentDate: string;
  onModeChange: (mode: ViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onResetToday: () => void;
  onToggleInbox: () => void;
  onToggleLater: () => void;
  onOpenSettings: () => void;
}

const formatDate = (isoDate: string): string => {
  if (!isoDate) {
    return "";
  }

  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const iconButton =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200/80 bg-transparent text-gray-700 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:border-gray-700/80 dark:text-gray-100 dark:hover:bg-white/5 dark:focus-visible:outline-gray-500";

const DesktopHeader = ({
  mode,
  currentDate,
  onModeChange,
  onPrev,
  onNext,
  onResetToday,
  onToggleInbox,
  onToggleLater,
  onOpenSettings,
}: DesktopHeaderProps) => {
  const formattedDate = useMemo(() => formatDate(currentDate), [currentDate]);

  return (
    <header className="hidden w-full bg-transparent pb-1 pt-0 text-sm text-gray-900 dark:text-gray-100 lg:block">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-2 lg:px-0">
        <div className="flex items-center justify-start gap-2">
          <button
            type="button"
            onClick={onToggleInbox}
            className={iconButton}
            aria-label="Toggle Inbox"
            title="Inbox"
          >
            <Inbox className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              className={iconButton}
              aria-label="Previous"
              title="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onNext}
              className={iconButton}
              aria-label="Next"
              title="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="inline-flex h-10 items-center gap-1 rounded-full border border-gray-200/80 bg-transparent px-1 text-sm font-medium shadow-none transition dark:border-gray-700/80">
            {(["day", "week"] as ViewMode[]).map((value) => {
              const isActive = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onModeChange(value)}
                  className={`inline-flex h-8 w-11 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:focus-visible:outline-gray-500 ${
                    isActive
                      ? "bg-gray-200 text-gray-900 font-semibold shadow-sm dark:bg-gray-200 dark:text-gray-900"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                  }`}
                  >
                  {value === "day" ? (
                    <Square className="h-5 w-5" aria-hidden />
                  ) : (
                    <Grid2x2 className="h-5 w-5" aria-hidden />
                  )}
                  <span className="sr-only">{value}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className={iconButton}
            aria-label="Open Settings"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleLater}
            className={iconButton}
            aria-label="Toggle Later"
            title="Later"
          >
            <Archive className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex justify-center px-2 lg:px-0">
        <button
          type="button"
          onClick={onResetToday}
          className="inline-flex items-center rounded-md px-3 py-2 text-base font-semibold text-gray-900 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 active:scale-[0.99] dark:text-gray-100 dark:hover:bg-white/5 dark:focus-visible:outline-gray-500"
          aria-label="Reset to today"
        >
          {formattedDate}
        </button>
      </div>
    </header>
  );
};

export default DesktopHeader;
