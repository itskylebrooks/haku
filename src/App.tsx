import { useEffect, useState } from "react";
import AddActivityModal from "./shared/components/AddActivityModal";
import type { Bucket } from "./shared/types/activity";
import AppShell from "./features/app-shell/AppShell";
import DayPage from "./features/day/DayPage";
import WeekPage from "./features/week/WeekPage";
import BoardPage from "./features/inbox/BoardPage";
import SettingsModal from "./shared/components/SettingsModal";
import { useHakuStore, type ThemeMode } from "./shared/storage";

type ViewMode = "day" | "week";
type ActiveTab = "board" | "day" | "week";

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
  const [activeTab, setActiveTab] = useState<ActiveTab>("day");
  const [currentDate, setCurrentDate] = useState<string>(todayIso());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalInitialPlacement, setAddModalInitialPlacement] = useState<Bucket | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Get settings from persisted store
  const weekStart = useHakuStore((state) => state.settings.weekStart);
  const themeMode = useHakuStore((state) => state.settings.themeMode);
  const setWeekStart = useHakuStore((state) => state.setWeekStart);
  const setThemeMode = useHakuStore((state) => state.setThemeMode);

  const handlePrev = () =>
    setCurrentDate((date) => shiftDate(date, mode, -1));
  const handleNext = () =>
    setCurrentDate((date) => shiftDate(date, mode, 1));
  const handleResetToday = () => setCurrentDate(todayIso());
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "day") {
      setMode("day");
      setCurrentDate(todayIso());
    } else if (tab === "week") {
      setMode("week");
      setCurrentDate(todayIso());
    } else if (tab === "board") {
      setCurrentDate(todayIso());
    }
  };
  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleOpenAddModal = (placement?: Bucket) => {
    // If a placement override provided, use it. Otherwise derive from current tab.
    if (placement) {
      setAddModalInitialPlacement(placement);
    } else {
      if (activeTab === "board") {
        setAddModalInitialPlacement("inbox");
      } else {
        // day/week -> schedule for today's date
        setAddModalInitialPlacement("scheduled");
      }
    }
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setAddModalInitialPlacement(undefined);
  };
  const handleCloseSettings = () => setIsSettingsOpen(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K to open add activity (context-sensitive)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleOpenAddModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab]);

  // Apply theme to document root
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved: ThemeMode =
        themeMode === "system" ? (mql.matches ? "dark" : "light") : themeMode;
      const shouldUseDark = resolved === "dark";
      const root = document.documentElement;
      root.classList.toggle("dark", shouldUseDark);
      root.dataset.theme = resolved;
      root.style.colorScheme = shouldUseDark ? "dark" : "light";
    };

    applyTheme();

    const handleChange = () => {
      if (themeMode === "system") {
        applyTheme();
      }
    };

    mql.addEventListener("change", handleChange);
    return () => {
      mql.removeEventListener("change", handleChange);
    };
  }, [themeMode]);

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] text-[var(--color-text-primary)]">
      <div
        className={`mx-auto flex min-h-screen flex-col pb-10 pt-6 ${
          mode === "week" ? "w-full max-w-none" : "max-w-6xl"
        }`}
      >
        <AppShell
          mode={mode}
          activeTab={activeTab}
          currentDate={currentDate}
          onModeChange={setMode}
          onTabChange={handleTabChange}
          onPrev={handlePrev}
          onNext={handleNext}
          onResetToday={handleResetToday}
          onOpenSettings={handleOpenSettings}
          onOpenAdd={handleOpenAddModal}
        >
          {activeTab === "board" ? (
            <BoardPage />
          ) : mode === "day" ? (
            <DayPage activeDate={currentDate} onResetToday={handleResetToday} />
          ) : (
            <WeekPage activeDate={currentDate} weekStart={weekStart} onResetToday={handleResetToday} />
          )}
        </AppShell>
      </div>
      <AddActivityModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        initialPlacement={addModalInitialPlacement}
        defaultDate={currentDate}
      />
      <SettingsModal
        open={isSettingsOpen}
        onClose={handleCloseSettings}
        weekStart={weekStart}
        onWeekStartChange={setWeekStart}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
      />
    </div>
  );
}

export default App;
