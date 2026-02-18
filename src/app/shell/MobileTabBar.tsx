import { useSmartSticky } from '@/shared/hooks/useSmartSticky';
import type { Bucket } from '@/shared/types/activity';
import { AnimatePresence, LayoutGroup, motion, type Transition, useReducedMotion } from 'framer-motion';
import { Circle, Grid2x2, Plus, Square } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ActiveTab = 'board' | 'day' | 'week';

interface MobileTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onAdd: (placement?: Bucket) => void;
  stickyKey: string;
}

const tabs: { id: ActiveTab; label: string; icon: LucideIcon }[] = [
  {
    id: 'board',
    label: 'Board',
    icon: Circle,
  },
  {
    id: 'day',
    label: 'Day',
    icon: Square,
  },
  {
    id: 'week',
    label: 'Week',
    icon: Grid2x2,
  },
];

const COMPACT = { width: 50, gap: 6, paddingX: 7, paddingY: 7, height: 46 };
const EXPANDED = { width: 66, gap: 7, paddingX: 8, paddingY: 8, height: 52 };
const ADD_COMPACT = { width: 48, height: 46, paddingX: 12 };
const ADD_EXPANDED = { width: 60, height: 52, paddingX: 14 };

const MobileTabBar = ({ activeTab, onTabChange, onAdd, stickyKey }: MobileTabBarProps) => {
  const shouldReduceMotion = useReducedMotion();
  const { isVisible, isMobile } = useSmartSticky(stickyKey);
  const isCompact = isMobile && !isVisible;
  const dims = isCompact ? COMPACT : EXPANDED;
  const addDims = isCompact ? ADD_COMPACT : ADD_EXPANDED;

  const springExpand: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring', damping: 22, stiffness: 280, mass: 0.8 };

  return (
    <nav
      className="fixed left-1/2 z-50 w-max -translate-x-1/2 select-none pb-[env(safe-area-inset-bottom)]"
      style={{ bottom: '1rem' }}
      aria-label="Main navigation"
    >
      <motion.div className="w-max" initial={false} animate={{ y: isCompact ? 4 : -4 }} transition={springExpand}>
        <LayoutGroup id="mobile-tab-bar">
          <motion.div
            className="relative inline-flex items-center rounded-full border border-[var(--color-border)] mobile-tab-bar"
            initial={false}
            animate={{
              gap: dims.gap,
              paddingLeft: dims.paddingX,
              paddingRight: dims.paddingX,
              paddingTop: dims.paddingY,
              paddingBottom: dims.paddingY,
            }}
            transition={springExpand}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (!isActive) onTabChange(tab.id);
                  }}
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative z-10 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-outline)]"
                >
                  <motion.div
                    className="relative flex items-center justify-center rounded-full"
                    initial={false}
                    animate={{
                      height: dims.height,
                      width: dims.width,
                      paddingTop: 6,
                      paddingBottom: 6,
                      paddingLeft: 6,
                      paddingRight: 6,
                    }}
                    transition={springExpand}
                    >
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.span
                          className="absolute inset-0 rounded-full bg-[var(--color-emphasis-bg)]"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.14, ease: 'easeInOut' }}
                        />
                      )}
                    </AnimatePresence>

                    <div className="relative z-10 flex h-full w-full items-center justify-center">
                      <motion.span
                        aria-hidden
                        className={`flex items-center justify-center pointer-events-none transition-colors duration-150 ${
                          isActive
                            ? 'text-[var(--color-emphasis-text)]'
                            : 'text-[var(--color-text-primary)]'
                        }`}
                        initial={false}
                        animate={{ scale: isCompact ? 1 : 1.2 }}
                        transition={springExpand}
                        style={{
                          width: 20,
                          height: 20,
                          willChange: 'transform',
                          transformOrigin: 'center center',
                          backfaceVisibility: 'hidden',
                        }}
                      >
                        <Icon className="h-full w-full" aria-hidden />
                      </motion.span>
                    </div>
                  </motion.div>
                </button>
              );
            })}

            <motion.span
              aria-hidden
              className="w-px bg-[var(--color-border)]"
              initial={false}
              animate={{
                opacity: isCompact ? 0.45 : 0.75,
                height: isCompact ? 24 : 36,
              }}
              transition={springExpand}
            />

            <motion.button
              type="button"
              onClick={() => {
                const placement: Bucket = activeTab === 'board' ? 'inbox' : 'scheduled';
                onAdd(placement);
              }}
              aria-label={`Add activity (${activeTab === 'board' ? 'Inbox' : 'Date'})`}
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-outline)]"
              initial={false}
              animate={{
                height: addDims.height,
                width: addDims.width,
                paddingLeft: addDims.paddingX,
                paddingRight: addDims.paddingX,
              }}
              transition={springExpand}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            >
              <motion.span
                className="inline-flex items-center justify-center"
                initial={false}
                animate={{ scale: isCompact ? 1 : 1.2 }}
                transition={springExpand}
                style={{
                  width: 20,
                  height: 20,
                  willChange: 'transform',
                  transformOrigin: 'center center',
                  backfaceVisibility: 'hidden',
                }}
              >
                <Plus className="h-full w-full" />
              </motion.span>
            </motion.button>
          </motion.div>
        </LayoutGroup>
      </motion.div>
    </nav>
  );
};

export default MobileTabBar;
