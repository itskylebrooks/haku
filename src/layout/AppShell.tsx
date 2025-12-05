import { useState } from "react";
import DesktopHeader from "../shared/components/layout/DesktopHeader";
import MobileHeader from "./MobileHeader";
import MobileTabBar from "./MobileTabBar";

type ViewMode = "day" | "week";
type ActiveTab = "inbox" | "day" | "week";

interface AppShellProps {
  mode: ViewMode;
  currentDate: string;
  onModeChange: (mode: ViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onResetToday: () => void;
  onToggleInbox: () => void;
  onToggleLater: () => void;
  onOpenSettings: () => void;
  onOpenAdd: () => void;
  children: React.ReactNode;
}

const AppShell = ({
  mode,
  currentDate,
  onModeChange,
  onPrev,
  onNext,
  onResetToday,
  onToggleInbox,
  onToggleLater,
  onOpenSettings,
  onOpenAdd,
  children,
}: AppShellProps) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("day");

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "day") {
      onModeChange("day");
    } else if (tab === "week") {
      onModeChange("week");
    }
    // For "inbox", mode remains unchanged
  };

  // Calculate prev/next based on active tab and mode
  const handleMobilePrev = () => {
    if (activeTab === "inbox") return;
    onPrev();
  };

  const handleMobileNext = () => {
    if (activeTab === "inbox") return;
    onNext();
  };

  return (
    <>
      {/* Desktop Header - hidden on mobile */}
      <DesktopHeader
        mode={mode}
        currentDate={currentDate}
        onModeChange={onModeChange}
        onPrev={onPrev}
        onNext={onNext}
        onResetToday={onResetToday}
        onToggleInbox={onToggleInbox}
        onToggleLater={onToggleLater}
        onOpenSettings={onOpenSettings}
        onOpenAdd={onOpenAdd}
      />

      {/* Mobile Header - hidden on desktop */}
      <MobileHeader
        activeTab={activeTab}
        currentDate={currentDate}
        onPrev={handleMobilePrev}
        onNext={handleMobileNext}
        onOpenSettings={onOpenSettings}
      />

      {/* Main content area */}
      <main className="flex-1 pb-24 md:pb-0">{children}</main>

      {/* Mobile Tab Bar - hidden on desktop */}
      <MobileTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAdd={onOpenAdd}
      />
    </>
  );
};

export default AppShell;
