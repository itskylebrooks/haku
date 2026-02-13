import { useEffect, useRef, useState } from 'react';

interface SimpleDatePickerProps {
  value: string | null;
  onChange: (next: string | null) => void;
  initialMonth?: string; // YYYY-MM format
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDisplayDate = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getMonthLabel = (year: number, month: number): string => {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

const toDateString = (year: number, month: number, day: number): string => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

const SimpleDatePicker = ({ value, onChange, initialMonth }: SimpleDatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Determine initial view month
  const getInitialView = (): { year: number; month: number } => {
    if (initialMonth) {
      const [y, m] = initialMonth.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    if (value) {
      const [y, m] = value.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  };

  const initial = getInitialView();
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (day: number) => {
    const dateStr = toDateString(viewYear, viewMonth, day);
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  const handleToggleOpen = () => {
    if (!isOpen && value) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
    setIsOpen((prev) => !prev);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  // Pad to complete the last row
  const remainder = calendarDays.length % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      calendarDays.push(null);
    }
  }

  const today = new Date();
  const todayStr = toDateString(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-transparent px-2 sm:px-3 py-2 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-focus)] focus:outline-none"
      >
        <span className="text-[var(--color-text-subtle)]">Date:</span>
        <span>{value ? formatDisplayDate(value) : 'Pick a date'}</span>
      </button>

      {/* Popup Calendar */}
      {isOpen && (
        <div
          ref={popupRef}
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg"
        >
          {/* Month Navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {getMonthLabel(viewYear, viewMonth)}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="mb-1 grid grid-cols-7 gap-0">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-1 text-center text-xs font-medium text-[var(--color-text-subtle)]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-0">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-8" />;
              }

              const dateStr = toDateString(viewYear, viewMonth, day);
              const isSelected = value === dateStr;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`flex h-8 w-full items-center justify-center rounded text-sm transition ${
                    isSelected
                      ? 'bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)]'
                      : isToday
                        ? 'font-semibold text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Clear Button */}
          <div className="mt-3 flex justify-end border-t border-[var(--color-border)] pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-[var(--color-text-subtle)] transition hover:text-[var(--color-text-primary)]"
            >
              Clear date
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleDatePicker;
