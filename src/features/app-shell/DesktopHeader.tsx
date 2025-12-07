import {
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Circle,
  Bolt,
  Square,
} from "lucide-react";
import { useMemo } from "react";

type ViewMode = "day" | "week";
type ActiveTab = "inbox" | "day" | "week";

interface DesktopHeaderProps {
  mode: ViewMode;
  activeTab: ActiveTab;
  currentDate: string;
  onTabChange: (tab: ActiveTab) => void;
  onPrev: () => void;
  onNext: () => void;
  onResetToday: () => void;
  onOpenSettings: () => void;
  onOpenAdd: () => void;
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
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]";

const DesktopHeader = ({
  mode,
  activeTab,
  currentDate,
  onTabChange,
  onPrev,
  onNext,
  onResetToday,
  onOpenSettings,
  onOpenAdd,
}: DesktopHeaderProps) => {
  const formattedDate = useMemo(() => formatDate(currentDate), [currentDate]);
  const selectedTab: ActiveTab = activeTab === "inbox" ? "inbox" : mode;

  return (
    <header className="sticky top-6 z-40 hidden bg-[var(--color-surface)] pb-1 pt-0 text-sm text-[var(--color-text-primary)] lg:block">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-[var(--color-surface)]"
      />
      <div className="mx-auto w-full max-w-xl px-4 pt-4 md:pt-0">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center justify-start gap-2">
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
            <div className="inline-flex h-10 items-center gap-1 rounded-full border border-[var(--color-border)] bg-transparent px-1 text-sm font-medium shadow-none transition">
              {(["inbox", "day", "week"] as ActiveTab[]).map((value) => {
                const isActive = selectedTab === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onTabChange(value)}
                    className={`inline-flex h-8 w-11 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] ${
                      isActive
                        ? "bg-[var(--color-surface-strong)] text-[var(--color-text-contrast)] font-semibold shadow-sm"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                    }`}
                    >
                    {value === "inbox" && <Circle className="h-5 w-5" aria-hidden />}
                    {value === "day" && <Square className="h-5 w-5" aria-hidden />}
                    {value === "week" && <Grid2x2 className="h-5 w-5" aria-hidden />}
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
              <Bolt className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <span aria-hidden />
          <button
            type="button"
            onClick={onResetToday}
            className="inline-flex items-center rounded-md px-3 py-2 text-base font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] active:scale-[0.99]"
            aria-label="Reset to today"
          >
            {formattedDate}
          </button>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onOpenAdd}
              className="inline-flex items-center rounded-md px-3 py-2 text-base font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] active:scale-[0.99]"
            >
              Add activity
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DesktopHeader;
