import { useEffect, useMemo, useRef, useState } from "react";
import type { Bucket, RepeatPattern } from "../types/activity";
import { useActivitiesStore } from "../store/activitiesStore";
import SimpleDatePicker from "./date/SimpleDatePicker";
import SimpleTimePicker from "./date/SimpleTimePicker";

type PlacementOption = "inbox" | "date" | "later";

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialPlacement?: Bucket;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const placementLabels: { key: PlacementOption; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "date", label: "Date" },
  { key: "later", label: "Later" },
];

const durationOptions: Array<number | null> = [
  null,
  ...Array.from({ length: 20 }, (_, index) => 15 * (index + 1)),
];

const formatDurationLabel = (minutes: number | null): string => {
  if (minutes === null) return "None";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} h ${remainingMinutes} min`;
  }
  if (hours > 0) {
    return `${hours} h`;
  }
  return `${remainingMinutes} min`;
};

const repeatOptions: { value: RepeatPattern; label: string }[] = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const AddActivityModal = ({
  isOpen,
  onClose,
  initialTitle,
  initialPlacement,
}: AddActivityModalProps) => {
  const addActivity = useActivitiesStore((state) => state.addActivity);

  const defaultPlacement: PlacementOption =
    initialPlacement === "scheduled" ? "date" : initialPlacement ?? "inbox";

  const [title, setTitle] = useState(initialTitle ?? "");
  const [placement, setPlacement] = useState<PlacementOption>(defaultPlacement);
  const [scheduledDate, setScheduledDate] = useState<string | null>(todayIso());
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [repeat, setRepeat] = useState<RepeatPattern>("none");
  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);
  const [isRepeatMenuOpen, setIsRepeatMenuOpen] = useState(false);
  const [note, setNote] = useState<string>("");
  const [showNote, setShowNote] = useState<boolean>(false);
  const durationContainerRef = useRef<HTMLDivElement>(null);
  const repeatContainerRef = useRef<HTMLDivElement>(null);

  const trimmedTitle = useMemo(() => title.trim(), [title]);
  const isDatePlacement = placement === "date";
  const showDurationAndRepeat = isDatePlacement && scheduledTime !== null;
  const canSubmit = Boolean(trimmedTitle) && (!isDatePlacement || !!scheduledDate);

  const resetForm = () => {
    setTitle(initialTitle ?? "");
    setPlacement(defaultPlacement);
    setScheduledDate(todayIso());
    setScheduledTime(null);
    setDurationMinutes(null);
    setRepeat("none");
    setIsDurationMenuOpen(false);
    setIsRepeatMenuOpen(false);
    setNote("");
    setShowNote(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTitle, initialPlacement]);

  useEffect(() => {
    if (scheduledTime === null) {
      setDurationMinutes(null);
      setRepeat("none");
      setIsDurationMenuOpen(false);
      setIsRepeatMenuOpen(false);
    }
  }, [scheduledTime]);

  useEffect(() => {
    if (!isDurationMenuOpen && !isRepeatMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const durationContains = durationContainerRef.current?.contains(target);
      const repeatContains = repeatContainerRef.current?.contains(target);

      if (!durationContains && !repeatContains) {
        setIsDurationMenuOpen(false);
        setIsRepeatMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDurationMenuOpen, isRepeatMenuOpen]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleDurationSelect = (value: number | null) => {
    setDurationMinutes(value);
    setIsDurationMenuOpen(false);
  };

  const handleRepeatSelect = (value: RepeatPattern) => {
    setRepeat(value);
    setIsRepeatMenuOpen(false);
  };

  const handleSubmit = () => {
    if (!trimmedTitle) return;

    let bucket: Bucket = "inbox";
    let dateValue: string | null = null;
    let timeValue: string | null = null;
    let durationValue: number | null = null;
    let repeatValue: RepeatPattern = "none";

    if (placement === "date") {
      bucket = "scheduled";
      if (!scheduledDate) return;
      dateValue = scheduledDate;
      timeValue = scheduledTime;
      if (timeValue !== null) {
        durationValue = durationMinutes;
        repeatValue = repeat;
      }
    } else if (placement === "later") {
      bucket = "later";
    }

    const noteValue = note.trim();

    addActivity({
      title: trimmedTitle,
      bucket,
      date: dateValue,
      time: timeValue,
      durationMinutes: durationValue,
      repeat: repeatValue,
      note: noteValue === "" ? null : noteValue,
    });

    handleClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[20vh] backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-96 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xl shadow-black/10 outline-none dark:border-gray-700/80 dark:bg-black"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Activity title"
              maxLength={100}
              className="w-full rounded-lg border border-gray-200/80 bg-transparent px-3 py-2 text-base text-gray-900 shadow-none outline-none ring-0 transition focus:border-gray-400 dark:border-gray-700/80 dark:text-gray-50 dark:focus:border-gray-500"
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {placementLabels.map(({ key, label }) => {
                const isActive = placement === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPlacement(key);
                      if (key !== "date") {
                        setIsDurationMenuOpen(false);
                        setIsRepeatMenuOpen(false);
                      }
                    }}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:focus-visible:outline-gray-500 ${
                      isActive
                        ? "bg-gray-900 text-white shadow-sm dark:bg-white dark:text-black"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {isDatePlacement && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <SimpleDatePicker
                    value={scheduledDate}
                    onChange={setScheduledDate}
                  />
                  <SimpleTimePicker
                    value={scheduledTime}
                    onChange={setScheduledTime}
                  />
                </div>

                {showDurationAndRepeat && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div ref={durationContainerRef} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDurationMenuOpen((prev) => !prev);
                          setIsRepeatMenuOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-transparent px-3 py-2 text-sm text-gray-900 transition hover:border-gray-300 focus:border-gray-400 focus:outline-none dark:border-gray-700/80 dark:text-gray-100 dark:hover:border-gray-600 dark:focus:border-gray-500"
                      >
                        <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                        <span>{formatDurationLabel(durationMinutes)}</span>
                      </button>

                      {isDurationMenuOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-200/80 bg-white p-2 shadow-lg dark:border-gray-700/80 dark:bg-black">
                          <div className="max-h-56 space-y-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {durationOptions.map((option) => {
                              const isSelected = durationMinutes === option;
                              return (
                                <button
                                  key={option ?? "none"}
                                  type="button"
                                  onClick={() => handleDurationSelect(option)}
                                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                                    isSelected
                                      ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                                    }`}
                                >
                                  {formatDurationLabel(option)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div ref={repeatContainerRef} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRepeatMenuOpen((prev) => !prev);
                          setIsDurationMenuOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-transparent px-3 py-2 text-sm text-gray-900 transition hover:border-gray-300 focus:border-gray-400 focus:outline-none dark:border-gray-700/80 dark:text-gray-100 dark:hover:border-gray-600 dark:focus:border-gray-500"
                      >
                        <span className="text-gray-500 dark:text-gray-400">Repeat:</span>
                        <span>
                          {repeatOptions.find((item) => item.value === repeat)?.label ??
                            "None"}
                        </span>
                      </button>

                      {isRepeatMenuOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 w-40 rounded-lg border border-gray-200/80 bg-white p-2 shadow-lg dark:border-gray-700/80 dark:bg-black">
                          <div className="max-h-56 space-y-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {repeatOptions.map(({ value, label }) => {
                              const isSelected = repeat === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => handleRepeatSelect(value)}
                                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                                    isSelected
                                      ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                                    }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {showNote ? (
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Add a note"
                maxLength={500}
                className="w-full rounded-lg border border-gray-200/80 bg-transparent px-3 py-2 text-base text-gray-900 shadow-none outline-none ring-0 transition focus:border-gray-400 dark:border-gray-700/80 dark:text-gray-100 dark:focus:border-gray-500"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="inline-flex items-center rounded-full border border-gray-200/80 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:border-gray-700/80 dark:text-gray-300 dark:hover:bg-white/5 dark:focus-visible:outline-gray-500"
              >
                Add note
              </button>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-gray-200/80 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:border-gray-700/80 dark:text-gray-300 dark:hover:bg-white/5 dark:focus-visible:outline-gray-500"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:focus-visible:outline-gray-500 ${
                canSubmit
                  ? "bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.99] dark:bg-white dark:text-black dark:hover:bg-gray-200"
                  : "cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
              }`}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddActivityModal;
