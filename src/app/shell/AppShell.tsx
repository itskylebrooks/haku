import type React from 'react';
import DesktopHeader from './DesktopHeader';
import MobileHeader from './MobileHeader';
import MobileTabBar from './MobileTabBar';
import { useDesktopLayout } from '@/shared/hooks/useDesktopLayout';
import type { Bucket } from '@/shared/types/activity';

type ViewMode = 'day' | 'week';
type ActiveTab = 'board' | 'day' | 'week';

interface AppShellProps {
  mode: ViewMode;
  activeTab: ActiveTab;
  currentDate: string;
  onModeChange: (mode: ViewMode) => void;
  onTabChange: (tab: ActiveTab) => void;
  onPrev: () => void;
  onNext: () => void;
  onResetToday: () => void;
  onOpenSettings: () => void;
  onOpenAdd: (placement?: Bucket) => void;
  children: React.ReactNode;
}

const AppShell = ({
  mode,
  activeTab,
  currentDate,
  onModeChange: _onModeChange,
  onTabChange,
  onPrev,
  onNext,
  onResetToday,
  onOpenSettings,
  onOpenAdd,
  children,
}: AppShellProps) => {
  const { isDesktop } = useDesktopLayout();
  // Calculate prev/next based on active tab
  const handlePrev = () => {
    if (activeTab === 'board') return;
    onPrev();
  };

  const handleNext = () => {
    if (activeTab === 'board') return;
    onNext();
  };

  return (
    <>
      {/* Desktop Header - hidden on mobile */}
      {isDesktop && (
        <DesktopHeader
          mode={mode}
          activeTab={activeTab}
          currentDate={currentDate}
          onTabChange={onTabChange}
          onPrev={handlePrev}
          onNext={handleNext}
          onResetToday={onResetToday}
          onOpenSettings={onOpenSettings}
          onOpenAdd={onOpenAdd}
        />
      )}

      {/* Mobile Header - hidden on desktop */}
      {!isDesktop && (
        <MobileHeader
          activeTab={activeTab}
          currentDate={currentDate}
          onPrev={handlePrev}
          onNext={handleNext}
          onOpenSettings={onOpenSettings}
          onResetToday={onResetToday}
        />
      )}

      {/* Main content area */}
      {/* Make the main content scrollable (when needed) and fill remaining height */}
      <main className="flex-1 overflow-auto overscroll-contain">
        {children}
        {!isDesktop && <div aria-hidden className="h-[var(--mobile-tabbar-reserved-safe)]" />}
      </main>

      {/* Mobile Tab Bar - hidden on desktop */}
      {!isDesktop && (
        <MobileTabBar activeTab={activeTab} onTabChange={onTabChange} onAdd={onOpenAdd} />
      )}
    </>
  );
};

export default AppShell;
