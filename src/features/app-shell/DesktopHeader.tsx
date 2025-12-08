import {
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Circle,
  Bolt,
  Square,
  Plus,
} from "lucide-react";

type ViewMode = "day" | "week";
type ActiveTab = "board" | "day" | "week";

interface DesktopHeaderProps {
  mode: ViewMode;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
  onOpenAdd: () => void;
}

const iconButton =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]";

const DesktopHeader = ({
  mode,
  activeTab,
  onTabChange,
  onPrev,
  onNext,
  onOpenSettings,
  onOpenAdd,
}: DesktopHeaderProps) => {
  const selectedTab: ActiveTab = activeTab === "board" ? "board" : mode;
  const chevronsDisabled = selectedTab === "board";

  return (
    <header className="sticky top-6 z-40 hidden bg-[var(--color-surface)] pb-4 pt-0 text-sm text-[var(--color-text-primary)] lg:block">
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
                onClick={chevronsDisabled ? undefined : onPrev}
                className={`${iconButton} ${
                  chevronsDisabled ? "cursor-default opacity-40" : ""
                }`}
                aria-label="Previous"
                title="Previous"
                disabled={chevronsDisabled}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={chevronsDisabled ? undefined : onNext}
                className={`${iconButton} ${
                  chevronsDisabled ? "cursor-default opacity-40" : ""
                }`}
                aria-label="Next"
                title="Next"
                disabled={chevronsDisabled}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-border)] bg-transparent px-1 text-sm font-medium shadow-none transition" style={{transform: 'translateX(30px)'}}>
              <div className="flex items-center gap-1">
                {(["board", "day", "week"] as ActiveTab[]).map((value) => {
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
                      {value === "board" && <Circle className="h-5 w-5" aria-hidden />}
                      {value === "day" && <Square className="h-5 w-5" aria-hidden />}
                      {value === "week" && <Grid2x2 className="h-5 w-5" aria-hidden />}
                      <span className="sr-only">{value}</span>
                    </button>
                  );
                })}
              </div>
              <div className="h-6 w-[1.5px] bg-[var(--color-border)]" />
              <button
                type="button"
                onClick={onOpenAdd}
                aria-label="Add activity"
                className="inline-flex h-8 items-center justify-center rounded-full bg-[var(--color-surface-strong)] px-3 text-[var(--color-text-contrast)] font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] active:scale-[0.99]"
              >
                <Plus className="h-5 w-5" />
              </button>
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
      </div>
    </header>
  );
};

export default DesktopHeader;
