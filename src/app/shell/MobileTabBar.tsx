import { useDesktopLayout } from '@/shared/hooks/useDesktopLayout';
import type { Bucket } from '@/shared/types/activity';
import { SPRING_TRANSITION } from '@/shared/ui/animations';
import { motion } from 'framer-motion';
import { Circle, Grid2x2, Plus, Square } from 'lucide-react';
import type React from 'react';

type ActiveTab = 'board' | 'day' | 'week';

interface MobileTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onAdd: (placement?: Bucket) => void;
}

const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'board',
    label: 'Board',
    icon: <Circle className="block h-6 w-6" aria-hidden />,
  },
  {
    id: 'day',
    label: 'Day',
    icon: <Square className="block h-6 w-6" aria-hidden />,
  },
  {
    id: 'week',
    label: 'Week',
    icon: <Grid2x2 className="block h-6 w-6" aria-hidden />,
  },
];

const MobileTabBar = ({ activeTab, onTabChange, onAdd }: MobileTabBarProps) => {
  const { shouldUseTouch } = useDesktopLayout();

  return (
    <nav
      className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="mb-1 mx-4 flex items-center justify-center gap-4 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 shadow-lg">
        <div className="flex items-center gap-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative inline-flex h-12 w-16 items-center justify-center rounded-full leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] ${
                  isActive
                    ? 'text-[var(--color-emphasis-text)] font-semibold shadow-sm'
                    : `text-[var(--color-text-primary)] ${!shouldUseTouch ? 'active:bg-[var(--color-surface-pressed)]' : ''}`
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-tab-pill"
                    className="absolute inset-0 rounded-full bg-[var(--color-emphasis-bg)] will-change-transform [backface-visibility:hidden]"
                    transition={SPRING_TRANSITION}
                    style={{ borderRadius: 9999 }}
                  />
                )}
                <span className="relative z-10 flex h-6 w-6 items-center justify-center will-change-transform transform-gpu [backface-visibility:hidden]">
                  {tab.icon}
                </span>
              </button>
            );
          })}
        </div>
        <div className="h-10 w-px bg-[var(--color-border)]" />
        <button
          type="button"
          onClick={() => {
            const placement: Bucket = activeTab === 'board' ? 'inbox' : 'scheduled';
            onAdd(placement);
          }}
          aria-label={`Add activity (${activeTab === 'board' ? 'Inbox' : 'Date'})`}
          className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-emphasis-bg)] px-5 text-[var(--color-emphasis-text)] font-semibold shadow-sm transition hover:bg-[var(--color-emphasis-bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] active:scale-[0.99]"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
};

export default MobileTabBar;
