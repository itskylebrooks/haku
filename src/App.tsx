import { useMemo, useState } from "react";
import AddActivityModal from "./shared/components/AddActivityModal";
import AppShell from "./features/app-shell/AppShell";
import DayPage from "./features/day/DayPage";

type ViewMode = "day" | "week";

const todayIso = () => new Date().toISOString().slice(0, 10);

const shiftDate = (isoDate: string, mode: ViewMode, direction: 1 | -1) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  const daysToMove = mode === "day" ? 1 : 7;
  date.setUTCDate(date.getUTCDate() + direction * daysToMove);

  return date.toISOString().slice(0, 10);
};

function App() {
  const [mode, setMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<string>(todayIso());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handlePrev = () =>
    setCurrentDate((date) => shiftDate(date, mode, -1));
  const handleNext = () =>
    setCurrentDate((date) => shiftDate(date, mode, 1));
  const handleResetToday = () => setCurrentDate(todayIso());
  const handleToggleInbox = () => {
    // Placeholder for future inbox toggle.
  };
  const handleToggleLater = () => {
    // Placeholder for future later toggle.
  };
  const handleOpenSettings = () => {
    // Placeholder for future settings action.
  };
  const handleOpenAddModal = () => setIsAddModalOpen(true);
  const handleCloseAddModal = () => setIsAddModalOpen(false);

  const currentSummary = useMemo(
    () => ({
      label: mode === "day" ? "Day view" : "Week view",
      iso: currentDate,
    }),
    [mode, currentDate]
  );

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col pb-10 pt-6">
        <AppShell
          mode={mode}
          currentDate={currentDate}
          onModeChange={setMode}
          onPrev={handlePrev}
          onNext={handleNext}
          onResetToday={handleResetToday}
          onToggleInbox={handleToggleInbox}
          onToggleLater={handleToggleLater}
          onOpenSettings={handleOpenSettings}
          onOpenAdd={handleOpenAddModal}
        >
          {mode === "day" ? (
            <DayPage activeDate={currentDate} />
          ) : (
            <div className="mx-4 mt-8 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] p-6 text-sm text-[var(--color-text-secondary)] shadow-sm md:mx-0">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-text-subtle)]">
                    Current mode
                  </span>
                  <span className="text-base font-semibold text-[var(--color-text-primary)]">
                    {currentSummary.label}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-text-subtle)]">
                    Active date
                  </span>
                  <span className="text-base font-semibold text-[var(--color-text-primary)]">
                    {currentSummary.iso}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                Week view coming soon. The header above controls the mode and
                date context shared across the desktop layout.
              </p>
            </div>
          )}
        </AppShell>
      </div>
      <AddActivityModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        defaultDate={currentDate}
      />
    </div>
  );
}

export default App;
