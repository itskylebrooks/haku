import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { useMemo } from "react";

type ActiveTab = "inbox" | "day" | "week";

interface MobileHeaderProps {
  activeTab: ActiveTab;
  currentDate: string;
  onPrev: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
  onResetToday: () => void;
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
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200/80 bg-transparent text-gray-700 transition active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:border-gray-700/80 dark:text-gray-100 dark:active:bg-white/10 dark:focus-visible:outline-gray-500";

const MobileHeader = ({
  activeTab,
  currentDate,
  onPrev,
  onNext,
  onOpenSettings,
  onResetToday,
}: MobileHeaderProps) => {
  const formattedDate = useMemo(() => formatDate(currentDate), [currentDate]);
  const chevronsDisabled = activeTab === "inbox";

  return (
    <header className="block w-full bg-white py-2 text-gray-900 dark:bg-black dark:text-gray-100 md:hidden">
      <div className="flex items-center justify-between px-4">
        {/* Left: Chevrons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={chevronsDisabled ? undefined : onPrev}
            className={`${iconButton} ${chevronsDisabled ? "cursor-default opacity-40" : ""}`}
            aria-label="Previous"
            title="Previous"
            disabled={chevronsDisabled}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={chevronsDisabled ? undefined : onNext}
            className={`${iconButton} ${chevronsDisabled ? "cursor-default opacity-40" : ""}`}
            aria-label="Next"
            title="Next"
            disabled={chevronsDisabled}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Center: Date */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <button
            type="button"
            onClick={onResetToday}
            className="rounded-md px-2 py-1 text-sm font-medium transition active:bg-gray-100 dark:active:bg-white/10"
          >
            {formattedDate}
          </button>
        </div>

        {/* Right: Settings */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onOpenSettings}
            className={iconButton}
            aria-label="Open Settings"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
