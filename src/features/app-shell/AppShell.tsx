import DesktopHeader from "./DesktopHeader";
import MobileHeader from "./MobileHeader";
import MobileTabBar from "./MobileTabBar";
import type { Bucket } from "../../shared/types/activity";

type ViewMode = "day" | "week";
type ActiveTab = "board" | "day" | "week";

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
  // Calculate prev/next based on active tab
  const handlePrev = () => {
    if (activeTab === "board") return;
    onPrev();
  };

  const handleNext = () => {
    if (activeTab === "board") return;
    onNext();
  };

  return (
    <>
      {/* Desktop Header - hidden on mobile */}
      <DesktopHeader
        mode={mode}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onPrev={handlePrev}
        onNext={handleNext}
        onOpenSettings={onOpenSettings}
      />

      {/* Mobile Header - hidden on desktop */}
      <MobileHeader
        activeTab={activeTab}
        currentDate={currentDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onOpenSettings={onOpenSettings}
        onResetToday={onResetToday}
      />

      {/* Main content area */}
      <main className="flex-1 pb-24 lg:pb-0">{children}</main>

      {/* Mobile Tab Bar - hidden on desktop */}
      <MobileTabBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        onAdd={onOpenAdd}
      />
    </>
  );
};

export default AppShell;
