import { Circle, Grid2x2, Plus, Square } from "lucide-react";

type ActiveTab = "board" | "day" | "week";

interface MobileTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onAdd: () => void;
}

const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "board",
    label: "Board",
    icon: <Circle className="h-6 w-6" />,
  },
  {
    id: "day",
    label: "Day",
    icon: <Square className="h-6 w-6" />,
  },
  {
    id: "week",
    label: "Week",
    icon: <Grid2x2 className="h-6 w-6" />,
  },
];

const MobileTabBar = ({ activeTab, onTabChange, onAdd }: MobileTabBarProps) => {
  return (
    <nav
      className="fixed bottom-4 left-0 right-0 z-50 flex justify-center pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Main navigation"
    >
      <div className="mb-1 mx-4 flex items-center justify-center gap-4 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-1.5 shadow-lg">
        <div className="flex items-center gap-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex h-10 w-14 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] ${
                  isActive
                    ? "bg-[var(--color-surface-strong)] text-[var(--color-text-contrast)] font-semibold shadow-sm"
                    : "text-[var(--color-text-subtle)] active:bg-[var(--color-surface-pressed)]"
                }`}
              >
                {tab.icon}
              </button>
            );
          })}
        </div>
        <div className="h-8 w-px bg-[var(--color-surface-divider)]" />
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add activity"
          className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--color-surface-strong)] px-4 text-[var(--color-text-contrast)] font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] active:scale-[0.99]"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
};

export default MobileTabBar;
