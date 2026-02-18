import { Bolt, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

type ActiveTab = 'board' | 'day' | 'week';

interface MobileHeaderProps {
  activeTab: ActiveTab;
  currentDate: string;
  isSyncPageOpen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
  onResetToday: () => void;
}

const formatDate = (isoDate: string): string => {
  if (!isoDate) {
    return '';
  }

  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatMonthYear = (isoDate: string): string => {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const iconButton =
  'inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] transition active:bg-[var(--color-surface-pressed)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]';

const MobileHeader = ({
  activeTab,
  currentDate,
  isSyncPageOpen,
  onPrev,
  onNext,
  onOpenSettings,
  onResetToday,
}: MobileHeaderProps) => {
  const formattedDate = useMemo(() => {
    if (activeTab === 'week') {
      return formatMonthYear(currentDate);
    }
    return formatDate(currentDate);
  }, [currentDate, activeTab]);
  const chevronsDisabled = activeTab === 'board' || isSyncPageOpen;

  return (
    <header className="sticky top-6 z-40 block w-full bg-[var(--color-surface)] py-2 text-[var(--color-text-primary)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-[var(--color-surface)]"
      />
      <div className="flex items-center justify-between px-4">
        {/* Left: Chevrons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={chevronsDisabled ? undefined : onPrev}
            className={`${iconButton} ${chevronsDisabled ? 'cursor-default opacity-40' : ''}`}
            aria-label="Previous"
            title="Previous"
            disabled={chevronsDisabled}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={chevronsDisabled ? undefined : onNext}
            className={`${iconButton} ${chevronsDisabled ? 'cursor-default opacity-40' : ''}`}
            aria-label="Next"
            title="Next"
            disabled={chevronsDisabled}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Center: Date */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <button
            type="button"
            onClick={onResetToday}
            className="rounded-md px-2 py-1 text-sm font-medium transition active:bg-[var(--color-surface-pressed)]"
          >
            {formattedDate}
          </button>
        </div>

        {/* Right: Settings */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onOpenSettings}
            className={iconButton}
            aria-label="Open Settings"
            title="Settings"
          >
            <Bolt className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
