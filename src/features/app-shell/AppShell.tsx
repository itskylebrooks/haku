import DesktopHeader from "./DesktopHeader";
import MobileHeader from "./MobileHeader";
import MobileTabBar from "./MobileTabBar";

type ViewMode = "day" | "week";
type ActiveTab = "inbox" | "day" | "week";

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
  onOpenAdd: () => void;
  children: React.ReactNode;
}

const AppShell = ({
  mode,
  activeTab,
  currentDate,
  onModeChange,
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
    if (activeTab === "inbox") return;
    onPrev();
  };

  const handleNext = () => {
    if (activeTab === "inbox") return;
    onNext();
  };

  return (
    <>
      {/* Desktop Header - hidden on mobile */}
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
      <main className="flex-1 pb-24 md:pb-0">{children}</main>

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
