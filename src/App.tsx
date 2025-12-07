import { useEffect, useState } from "react";
import AddActivityModal from "./shared/components/AddActivityModal";
import AppShell from "./features/app-shell/AppShell";
import DayPage from "./features/day/DayPage";
import WeekPage from "./features/week/WeekPage";
import BoardPage from "./features/inbox/BoardPage";
import SettingsModal from "./shared/components/SettingsModal";

type ViewMode = "day" | "week";
type ActiveTab = "board" | "day" | "week";
type ThemeMode = "system" | "light" | "dark";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [weekStart, setWeekStart] = useState<"monday" | "sunday">("monday");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  const handlePrev = () =>
    setCurrentDate((date) => shiftDate(date, mode, -1));
  const handleNext = () =>
    setCurrentDate((date) => shiftDate(date, mode, 1));
  const handleResetToday = () => setCurrentDate(todayIso());
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "day") {
      setMode("day");
    } else if (tab === "week") {
      setMode("week");
    } else if (tab === "board") {
      setCurrentDate(todayIso());
    }
  };
  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleOpenAddModal = () => setIsAddModalOpen(true);
  const handleCloseAddModal = () => setIsAddModalOpen(false);
  const handleCloseSettings = () => setIsSettingsOpen(false);

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
            <DayPage activeDate={currentDate} />
          ) : (
            <WeekPage activeDate={currentDate} weekStart={weekStart} />
          )}
        </AppShell>
      </div>
      <AddActivityModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
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
