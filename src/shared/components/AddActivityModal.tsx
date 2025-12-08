import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Square, Diamond } from "lucide-react";
import type { Activity, Bucket, RepeatPattern } from "../types/activity";
import { useActivitiesStore } from "../store/activitiesStore";
import SimpleDatePicker from "./date/SimpleDatePicker";
import SimpleTimePicker from "./date/SimpleTimePicker";

type PlacementOption = "inbox" | "date" | "later";
type ModalMode = "create" | "edit";

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialPlacement?: Bucket;
  mode?: ModalMode;
  activityToEdit?: Activity;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<Activity, "id" | "createdAt">>) => void;
  defaultDate?: string;
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
  mode = "create",
  activityToEdit,
  onDelete,
  onUpdate,
  defaultDate,
}: AddActivityModalProps) => {
  const addActivity = useActivitiesStore((state) => state.addActivity);

  const isEditMode = mode === "edit" && activityToEdit !== undefined;
  const isPlacementLocked = Boolean(isEditMode && activityToEdit?.isDone);

  // Derive initial placement from activity being edited or use defaults
  const getInitialPlacement = (): PlacementOption => {
    if (isEditMode) {
      if (activityToEdit.bucket === "scheduled") return "date";
      if (activityToEdit.bucket === "later") return "later";
      return "inbox";
    }
    return initialPlacement === "scheduled" ? "date" : initialPlacement ?? "inbox";
  };

  const getInitialDate = (): string | null => {
    if (isEditMode && activityToEdit.date !== null) {
      return activityToEdit.date;
    }
    return defaultDate ?? todayIso();
  };

  const defaultPlacement = getInitialPlacement();

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
    if (isEditMode) {
      // Pre-fill with activity values for edit mode
      setTitle(activityToEdit.title);
      setPlacement(getInitialPlacement());
      setScheduledDate(activityToEdit.date ?? getInitialDate());
      setScheduledTime(activityToEdit.time);
      setDurationMinutes(activityToEdit.durationMinutes);
      setRepeat(activityToEdit.repeat);
      setNote(activityToEdit.note ?? "");
      setShowNote(activityToEdit.note !== null && activityToEdit.note !== "");
    } else {
      // Reset to defaults for create mode
      setTitle(initialTitle ?? "");
      setPlacement(defaultPlacement);
      setScheduledDate(getInitialDate());
      setScheduledTime(null);
      setDurationMinutes(null);
      setRepeat("none");
      setNote("");
      setShowNote(false);
    }
    setIsDurationMenuOpen(false);
    setIsRepeatMenuOpen(false);
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
  }, [isOpen, initialTitle, initialPlacement, activityToEdit, mode]);

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

    if (isEditMode && onUpdate) {
      // Edit mode: update existing activity
      onUpdate(activityToEdit.id, {
        title: trimmedTitle,
        bucket,
        date: dateValue,
        time: timeValue,
        durationMinutes: durationValue,
        repeat: repeatValue,
        note: noteValue === "" ? null : noteValue,
      });
    } else {
      // Create mode: add new activity
      addActivity({
        title: trimmedTitle,
        bucket,
        date: dateValue,
        time: timeValue,
        durationMinutes: durationValue,
        repeat: repeatValue,
        note: noteValue === "" ? null : noteValue,
      });
    }

    handleClose();
  };

  const handleDelete = () => {
    if (isEditMode && onDelete) {
      onDelete(activityToEdit.id);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--color-overlay)] px-4 pt-[20vh] backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-96 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-elevated)] outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Activity title"
              maxLength={100}
              className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-base text-[var(--color-text-primary)] shadow-none outline-none ring-0 transition focus:border-[var(--color-border-focus)]"
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {placementLabels.map(({ key, label }) => {
                const isActive = placement === key;
                const isDisabled = isPlacementLocked && key !== "date";
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setPlacement(key);
                      if (key !== "date") {
                        setIsDurationMenuOpen(false);
                        setIsRepeatMenuOpen(false);
                      }
                    }}
                    className={`w-full h-10 flex items-center justify-center rounded-lg px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] ${
                      isActive
                        ? "bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)] shadow-sm border-0"
                        : "border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]"
                    } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {key === "inbox" && <Circle className="w-4 h-4" />}
                    {key === "date" && <Square className="w-4 h-4" />}
                    {key === "later" && <Diamond className="w-4 h-4" />}
                    <span className="sr-only">{label}</span>
                    <span className="hidden">&nbsp;</span>
                    <span className="ml-1">{label}</span>
                  </button>
                );
              })}
            </div>

            {isDatePlacement && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="w-full">
                    <SimpleDatePicker
                      value={scheduledDate}
                      onChange={setScheduledDate}
                    />
                  </div>
                  <div className="w-full">
                    <SimpleTimePicker
                      value={scheduledTime}
                      onChange={setScheduledTime}
                    />
                  </div>
                </div>

                {showDurationAndRepeat && (
                  <div className="grid grid-cols-2 gap-3">
                    <div ref={durationContainerRef} className="relative w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDurationMenuOpen((prev) => !prev);
                          setIsRepeatMenuOpen(false);
                        }}
                        className="w-full h-10 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-transparent px-3 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-focus)] focus:outline-none"
                      >
                        <span className="text-[var(--color-text-subtle)]">Duration:</span>
                        <span>{formatDurationLabel(durationMinutes)}</span>
                      </button>

                      {isDurationMenuOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-lg">
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
                                      ? "bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)]"
                                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
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

                    <div ref={repeatContainerRef} className="relative w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRepeatMenuOpen((prev) => !prev);
                          setIsDurationMenuOpen(false);
                        }}
                        className="w-full h-10 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-transparent px-3 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-focus)] focus:outline-none"
                      >
                        <span className="text-[var(--color-text-subtle)]">Repeat:</span>
                        <span>
                          {repeatOptions.find((item) => item.value === repeat)?.label ??
                            "None"}
                        </span>
                      </button>

                      {isRepeatMenuOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-lg">
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
                                      ? "bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)]"
                                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
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
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-base text-[var(--color-text-primary)] shadow-none outline-none ring-0 transition focus:border-[var(--color-border-focus)]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="w-full flex items-center justify-center rounded-lg h-10 px-3 text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
              >
                Add note
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {/* Delete button (edit mode only) */}
            {isEditMode ? (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md border border-[var(--color-danger-border)] px-4 py-2 text-sm font-medium text-[var(--color-danger-text)] transition hover:bg-[var(--color-danger-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-danger-text)]"
              >
                Delete
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] ${
                  canSubmit
                    ? "bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)] hover:bg-[var(--color-emphasis-bg-hover)] active:scale-[0.99]"
                    : "cursor-not-allowed bg-[var(--color-disabled-bg)] text-[var(--color-disabled-text)]"
                }`}
              >
                {isEditMode ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddActivityModal;
