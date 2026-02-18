import { AppShell } from '@/app/shell';
import { BoardPage } from '@/features/board';
import { DayPage } from '@/features/day';
import { InstallInstructionsModal, SettingsModal } from '@/features/settings';
import { SyncPage } from '@/features/sync';
import { WeekPage } from '@/features/week';
import { usePWA } from '@/shared/hooks/usePWA';
import { useHakuStore, type ThemeMode } from '@/shared/state';
import type { Bucket } from '@/shared/types/activity';
import { AddActivityModal } from '@/shared/ui';
import { createPageMotion } from '@/shared/ui/animations';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

type ViewMode = 'day' | 'week';
type ActiveTab = 'board' | 'day' | 'week';

const todayIso = () => new Date().toISOString().slice(0, 10);

const shiftDate = (isoDate: string, mode: ViewMode, direction: 1 | -1) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  const daysToMove = mode === 'day' ? 1 : 7;
  date.setUTCDate(date.getUTCDate() + direction * daysToMove);

  return date.toISOString().slice(0, 10);
};

function App() {
  const [mode, setMode] = useState<ViewMode>('day');
  const [activeTab, setActiveTab] = useState<ActiveTab>('day');
  const [currentDate, setCurrentDate] = useState<string>(todayIso());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalInitialPlacement, setAddModalInitialPlacement] = useState<Bucket | undefined>(
    undefined,
  );
  const [addModalDefaultDate, setAddModalDefaultDate] = useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [direction, setDirection] = useState(0);

  const { isInstallable, isInstalled, installPwa } = usePWA();
  const [isInstallInstructionsOpen, setIsInstallInstructionsOpen] = useState(false);
  const [isSyncPageOpen, setIsSyncPageOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const pageMotion = createPageMotion(shouldReduceMotion);

  const scrollToTop = () => {
    const main = document.querySelector('main');
    if (main && typeof (main as HTMLElement).scrollTo === 'function') {
      (main as HTMLElement).scrollTo({ top: 0, behavior: 'auto' });
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Get settings from persisted store
  const weekStart = useHakuStore((state) => state.settings.weekStart);
  const themeMode = useHakuStore((state) => state.settings.themeMode);
  const setWeekStart = useHakuStore((state) => state.setWeekStart);
  const setThemeMode = useHakuStore((state) => state.setThemeMode);

  const handlePrev = () => {
    if (isSyncPageOpen) {
      return;
    }
    setDirection(-1);
    setCurrentDate((date) => shiftDate(date, mode, -1));
  };
  const handleNext = () => {
    if (isSyncPageOpen) {
      return;
    }
    setDirection(1);
    setCurrentDate((date) => shiftDate(date, mode, 1));
  };
  const handleResetToday = () => {
    if (isSyncPageOpen) {
      return;
    }
    const today = todayIso();
    // Determine direction based on comparison with current
    if (today > currentDate) setDirection(1);
    else if (today < currentDate) setDirection(-1);
    else setDirection(0);
    setCurrentDate(today);
  };
  const handleTabChange = (tab: ActiveTab) => {
    setIsSyncPageOpen(false);
    setActiveTab(tab);
    if (tab === 'day') {
      setMode('day');
      setCurrentDate(todayIso());
    } else if (tab === 'week') {
      setMode('week');
      setCurrentDate(todayIso());
    } else if (tab === 'board') {
      setCurrentDate(todayIso());
    }
  };
  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleOpenAddModal = useCallback(
    (placement?: Bucket) => {
      if (isSyncPageOpen) {
        return;
      }
      // If a placement override provided, use it. Otherwise derive from current tab.
      if (placement) {
        setAddModalInitialPlacement(placement);
        setAddModalDefaultDate(placement === 'scheduled' ? todayIso() : undefined);
      } else {
        if (activeTab === 'board') {
          setAddModalInitialPlacement('inbox');
          setAddModalDefaultDate(undefined);
        } else {
          // day/week -> schedule for today's date
          setAddModalInitialPlacement('scheduled');
          setAddModalDefaultDate(todayIso());
        }
      }
      setIsAddModalOpen(true);
    },
    [activeTab, isSyncPageOpen],
  );

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setAddModalInitialPlacement(undefined);
    setAddModalDefaultDate(undefined);
  };
  const handleCloseSettings = () => setIsSettingsOpen(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K to open add activity (context-sensitive)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleOpenAddModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, handleOpenAddModal]);

  useEffect(() => {
    scrollToTop();
  }, [activeTab, mode, isSyncPageOpen]);

  // Apply theme to document root
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved: ThemeMode =
        themeMode === 'system' ? (mql.matches ? 'dark' : 'light') : themeMode;
      const shouldUseDark = resolved === 'dark';
      const root = document.documentElement;
      root.classList.toggle('dark', shouldUseDark);
      root.dataset.theme = resolved;
      root.style.colorScheme = shouldUseDark ? 'dark' : 'light';
    };

    applyTheme();

    const handleChange = () => {
      if (themeMode === 'system') {
        applyTheme();
      }
    };

    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, [themeMode]);

  // Work around mobile browser vh variations (URL bar / toolbars) by setting
  // a CSS variable to the actual innerHeight. This lets layout use a stable
  // --app-height value which corresponds to the *real* viewport height so
  // our content area can be sized without creating extra scroll space.
  useEffect(() => {
    const setAppHeightVar = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    setAppHeightVar();
    window.addEventListener('resize', setAppHeightVar);
    window.addEventListener('orientationchange', setAppHeightVar);
    // Use visualViewport when available for smoother updates on mobile
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setAppHeightVar);
    }
    return () => {
      window.removeEventListener('resize', setAppHeightVar);
      window.removeEventListener('orientationchange', setAppHeightVar);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', setAppHeightVar);
      }
    };
  }, []);

  return (
    <div
      className="bg-[var(--color-page-bg)] text-[var(--color-text-primary)]"
      style={{ height: 'var(--app-height, 100vh)' }}
    >
      <div className="mx-auto flex h-full flex-col pb-10 pt-6 w-full">
        <AppShell
          mode={mode}
          activeTab={activeTab}
          currentDate={currentDate}
          isSyncPageOpen={isSyncPageOpen}
          onModeChange={setMode}
          onTabChange={handleTabChange}
          onPrev={handlePrev}
          onNext={handleNext}
          onResetToday={handleResetToday}
          onOpenSettings={handleOpenSettings}
          onOpenAdd={handleOpenAddModal}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isSyncPageOpen ? (
              <motion.div
                key="sync"
                initial={pageMotion.initial}
                animate={pageMotion.animate}
                transition={pageMotion.transition}
                className="min-h-full max-w-6xl mx-auto w-full"
              >
                <SyncPage />
              </motion.div>
            ) : activeTab === 'board' ? (
              <motion.div
                key="board"
                initial={pageMotion.initial}
                animate={pageMotion.animate}
                transition={pageMotion.transition}
                className="min-h-full max-w-6xl mx-auto w-full"
              >
                <BoardPage />
              </motion.div>
            ) : mode === 'day' ? (
              <motion.div
                key="day"
                initial={pageMotion.initial}
                animate={pageMotion.animate}
                transition={pageMotion.transition}
                className="min-h-full max-w-6xl mx-auto w-full"
              >
                <DayPage
                  activeDate={currentDate}
                  onResetToday={handleResetToday}
                  direction={direction}
                />
              </motion.div>
            ) : (
              <motion.div
                key="week"
                initial={pageMotion.initial}
                animate={pageMotion.animate}
                transition={pageMotion.transition}
                className="min-h-full w-full"
              >
                <WeekPage
                  activeDate={currentDate}
                  weekStart={weekStart}
                  onResetToday={handleResetToday}
                  direction={direction}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </AppShell>
      </div>
      <AddActivityModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        initialPlacement={addModalInitialPlacement}
        defaultDate={addModalDefaultDate ?? currentDate}
      />
      <SettingsModal
        open={isSettingsOpen}
        onClose={handleCloseSettings}
        weekStart={weekStart}
        onWeekStartChange={setWeekStart}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        onInstall={installPwa}
        onShowInstallInstructions={() => {
          setIsSettingsOpen(false);
          setIsInstallInstructionsOpen(true);
        }}
        onShowSyncPage={() => {
          setIsSettingsOpen(false);
          setIsSyncPageOpen(true);
        }}
      />
      <InstallInstructionsModal
        open={isInstallInstructionsOpen}
        onClose={() => setIsInstallInstructionsOpen(false)}
      />
    </div>
  );
}

export default App;
