import { useEffect, useRef, useState } from "react";

interface SimpleTimePickerProps {
  value: string | null;
  onChange: (next: string | null) => void;
}

// Generate time options every 15 minutes
const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hStr = String(h).padStart(2, "0");
      const mStr = String(m).padStart(2, "0");
      options.push(`${hStr}:${mStr}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const formatDisplayTime = (timeStr: string): string => {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

const SimpleTimePicker = ({ value, onChange }: SimpleTimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Scroll to selected time when popup opens
  useEffect(() => {
    if (isOpen && listRef.current && value) {
      const index = TIME_OPTIONS.indexOf(value);
      if (index >= 0) {
        const itemHeight = 36; // approximate height of each item
        listRef.current.scrollTop = Math.max(0, index * itemHeight - 72);
      }
    }
  }, [isOpen, value]);

  const handleTimeClick = (time: string) => {
    onChange(time);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-sm text-gray-900 transition hover:border-gray-300 focus:border-gray-400 focus:outline-none dark:border-neutral-700 dark:text-gray-100 dark:hover:border-gray-600 dark:focus:border-gray-500"
      >
        <span className="text-gray-500 dark:text-gray-400">Time:</span>
        <span>{value ? formatDisplayTime(value) : "None"}</span>
      </button>

      {/* Popup Time List */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-black">
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto overscroll-contain space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TIME_OPTIONS.map((time) => {
              const isSelected = value === time;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => handleTimeClick(time)}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="tabular-nums">{formatDisplayTime(time)}</span>
                </button>
              );
            })}
          </div>

          {/* Clear Button */}
          <div className="border-t border-neutral-200 px-3 py-2 dark:border-neutral-700">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear time
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleTimePicker;
