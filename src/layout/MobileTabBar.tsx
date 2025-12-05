import { Grid2x2, Inbox, Square } from "lucide-react";

type ActiveTab = "inbox" | "day" | "week";

interface MobileTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "inbox",
    label: "Inbox",
    icon: <Inbox className="h-6 w-6" />,
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

const MobileTabBar = ({ activeTab, onTabChange }: MobileTabBarProps) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main navigation"
    >
      <div className="mb-1 mx-4 flex items-center justify-center gap-4 rounded-full border border-gray-200/80 bg-white px-3 py-1.5 shadow-lg dark:border-gray-700/80 dark:bg-black">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex h-10 w-14 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:focus-visible:outline-gray-500 ${
                isActive
                  ? "bg-gray-200 text-gray-900 font-semibold shadow-sm dark:bg-gray-200 dark:text-gray-900"
                  : "text-gray-500 active:bg-gray-100 dark:text-gray-400 dark:active:bg-white/10"
              }`}
            >
              {tab.icon}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileTabBar;
