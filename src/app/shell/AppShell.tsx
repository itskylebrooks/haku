import { useDesktopLayout } from '@/shared/hooks/useDesktopLayout';
import type { Bucket } from '@/shared/types/activity';
import { AppScrollContainerProvider } from '@/shared/ui/layout/AppScrollContainer';
import { useCallback, useState, type ReactNode } from 'react';
import DesktopHeader from './DesktopHeader';
import MobileHeader from './MobileHeader';
import MobileTabBar from './MobileTabBar';

type ViewMode = 'day' | 'week';
type ActiveTab = 'board' | 'day' | 'week';

interface AppShellProps {
  mode: ViewMode;
  activeTab: ActiveTab;
  currentDate: string;
  isSyncPageOpen: boolean;
  onScrollContainerChange: (container: HTMLElement | null) => void;
  onTabChange: (tab: ActiveTab) => void;
  onPrev: () => void;
  onNext: () => void;
  onResetToday: () => void;
  onOpenSettings: () => void;
  onOpenAdd: (placement?: Bucket) => void;
  children: ReactNode;
}

const AppShell = ({
  mode,
  activeTab,
  currentDate,
  isSyncPageOpen,
  onScrollContainerChange,
  onTabChange,
  onPrev,
  onNext,
  onResetToday,
  onOpenSettings,
  onOpenAdd,
  children,
}: AppShellProps) => {
  const { isDesktop } = useDesktopLayout();
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  const handleScrollContainer = useCallback(
    (container: HTMLElement | null) => {
      setScrollContainer(container);
      onScrollContainerChange(container);
    },
    [onScrollContainerChange],
  );
  // Calculate prev/next based on active tab
  const handlePrev = () => {
    if (activeTab === 'board' || isSyncPageOpen) return;
    onPrev();
  };

  const handleNext = () => {
    if (activeTab === 'board' || isSyncPageOpen) return;
    onNext();
  };

  return (
    <AppScrollContainerProvider container={scrollContainer}>
      {/* Desktop Header - hidden on mobile */}
      {isDesktop && (
        <DesktopHeader
          mode={mode}
          activeTab={activeTab}
          currentDate={currentDate}
          isSyncPageOpen={isSyncPageOpen}
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
          isSyncPageOpen={isSyncPageOpen}
          onPrev={handlePrev}
          onNext={handleNext}
          onOpenSettings={onOpenSettings}
          onResetToday={onResetToday}
        />
      )}

      {/* Main content area */}
      {/* Make the main content scrollable (when needed) and fill remaining height */}
      <main ref={handleScrollContainer} className="flex-1 overflow-auto overscroll-contain">
        {children}
        {!isDesktop && <div aria-hidden className="h-[var(--mobile-tabbar-reserved-safe)]" />}
      </main>

      {/* Mobile Tab Bar - hidden on desktop */}
      {!isDesktop && (
        <MobileTabBar
          activeTab={activeTab}
          onTabChange={onTabChange}
          onAdd={onOpenAdd}
          stickyKey={isSyncPageOpen ? 'sync' : activeTab}
        />
      )}
    </AppScrollContainerProvider>
  );
};

export default AppShell;
