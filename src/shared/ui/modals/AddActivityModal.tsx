import { useActivitiesStore } from '@/shared/state';
import type { Activity, Bucket } from '@/shared/types/activity';
import { BACKDROP_VARIANTS, SCALE_FADE_VARIANTS } from '@/shared/ui/animations';
import { AnimatePresence, motion } from 'framer-motion';
import { Circle, Diamond, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SimpleDatePicker from '../date/SimpleDatePicker';
import SimpleTimePicker from '../date/SimpleTimePicker';

// Date helpers
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const addWeeks = (date: Date, weeks: number): Date => {
  return addDays(date, weeks * 7);
};

const formatDate = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

type PlacementOption = 'inbox' | 'date' | 'later';
type ModalMode = 'create' | 'edit';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialPlacement?: Bucket;
  mode?: ModalMode;
  activityToEdit?: Activity;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<Activity, 'id' | 'createdAt'>>) => void;
  defaultDate?: string;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const placementLabels: { key: PlacementOption; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'date', label: 'Date' },
  { key: 'later', label: 'Later' },
];

const formatDurationLabel = (minutes: number | null): string => {
  if (minutes === null) return 'None';
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

const AddActivityModalContent = ({
  onClose,
  initialTitle,
  initialPlacement,
  mode = 'create',
  activityToEdit,
  onDelete,
  onUpdate,
  defaultDate,
}: AddActivityModalProps) => {
  const addActivity = useActivitiesStore((state) => state.addActivity);

  const isEditMode = mode === 'edit' && activityToEdit !== undefined;
  const isPlacementLocked = Boolean(isEditMode && activityToEdit?.isDone);

  // Derive initial placement from activity being edited or use defaults
  const getInitialPlacement = (): PlacementOption => {
    if (isEditMode) {
      if (activityToEdit.bucket === 'scheduled') return 'date';
      if (activityToEdit.bucket === 'later') return 'later';
      return 'inbox';
    }
    return initialPlacement === 'scheduled' ? 'date' : (initialPlacement ?? 'inbox');
  };

  const getInitialDate = (): string | null => {
    if (isEditMode && activityToEdit.date !== null) {
      return activityToEdit.date;
    }
    return defaultDate ?? todayIso();
  };

  const getInitialTime = (): string | null => {
    if (isEditMode) {
      return activityToEdit.time;
    }
    return null;
  };

  const getInitialDuration = (): number | null => {
    if (isEditMode) {
      return activityToEdit.durationMinutes;
    }
    return null;
  };

  const getInitialTitle = (): string => {
    if (isEditMode) {
      return activityToEdit.title;
    }
    return initialTitle ?? '';
  };

  const getInitialNote = (): string => {
    if (isEditMode) {
      return activityToEdit.note ?? '';
    }
    return '';
  };

  const getInitialShowNote = (): boolean => {
    if (isEditMode) {
      return activityToEdit.note !== null && activityToEdit.note !== '';
    }
    return false;
  };

  const [title, setTitle] = useState(getInitialTitle);
  const [placement, setPlacement] = useState<PlacementOption>(getInitialPlacement);
  const [scheduledDate, setScheduledDate] = useState<string | null>(getInitialDate);
  const [scheduledTime, setScheduledTime] = useState<string | null>(getInitialTime);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(getInitialDuration);

  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);

  // Duplicate forward state
  const [isDuplicateMenuOpen, setIsDuplicateMenuOpen] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [duplicateInterval, setDuplicateInterval] = useState<'day' | 'week'>('day');
  const duplicateContainerRef = useRef<HTMLDivElement>(null);

  const [note, setNote] = useState<string>(getInitialNote);
  const [showNote, setShowNote] = useState<boolean>(getInitialShowNote);
  const durationContainerRef = useRef<HTMLDivElement>(null);

  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  const trimmedTitle = useMemo(() => title.trim(), [title]);
  const isDatePlacement = placement === 'date';
  // Show duration if time is set; duplicate/repeat logic will replace old repeat logic
  const showDuration = isDatePlacement && scheduledTime !== null;
  const canSubmit = Boolean(trimmedTitle) && (!isDatePlacement || !!scheduledDate);

  useEffect(() => {
    // Lock scrolling on mount logic
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Reset duration and duplicate state when scheduled time is removed
  if (
    scheduledTime === null &&
    (durationMinutes !== null || isDuplicateMenuOpen || duplicateCount > 0)
  ) {
    setDurationMinutes(null);
    setIsDurationMenuOpen(false);
    setIsDuplicateMenuOpen(false);
    setDuplicateCount(0);
    setDuplicateInterval('day');
  }

  useEffect(() => {
    if (!isDurationMenuOpen && !isDuplicateMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const durationContains = durationContainerRef.current?.contains(target);
      const duplicateContains = duplicateContainerRef.current?.contains(target);

      if (!durationContains && !duplicateContains) {
        setIsDurationMenuOpen(false);
        setIsDuplicateMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {};
  }, [isDurationMenuOpen, isDuplicateMenuOpen]);

  useEffect(() => {
    if (showNote) {
      // Focus the textarea when it becomes visible
      // Use a small timeout to ensure the element is mounted
      const id = window.setTimeout(() => {
        noteRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [showNote]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    if (!trimmedTitle) return;

    let bucket: Bucket = 'inbox';
    let dateValue: string | null = null;
    let timeValue: string | null = null;
    let durationValue: number | null = null;

    if (placement === 'date') {
      bucket = 'scheduled';
      if (!scheduledDate) return;
      dateValue = scheduledDate;
      timeValue = scheduledTime;
      if (timeValue !== null) {
        durationValue = durationMinutes;
      }
    } else if (placement === 'later') {
      bucket = 'later';
    }

    const noteValue = note.trim();

    // Unified handle for both create and edit mode to support duplication
    if (isEditMode && onUpdate) {
      // Edit mode: update existing activity
      onUpdate(activityToEdit.id, {
        title: trimmedTitle,
        bucket,
        date: dateValue,
        time: timeValue,
        durationMinutes: durationValue,
        note: noteValue === '' ? null : noteValue,
      });
    } else {
      // Create mode: add new activity
      addActivity({
        title: trimmedTitle,
        bucket,
        date: dateValue,
        time: timeValue,
        durationMinutes: durationValue,
        note: noteValue === '' ? null : noteValue,
      });
    }

    // Handle duplicates if configured and we have a valid date (works for both edit and create)
    if (duplicateCount > 0 && dateValue) {
      const baseDate = new Date(dateValue);

      for (let i = 1; i <= duplicateCount; i++) {
        const nextDate =
          duplicateInterval === 'week' ? addWeeks(baseDate, i) : addDays(baseDate, i);

        addActivity({
          title: trimmedTitle,
          bucket,
          date: formatDate(nextDate),
          time: timeValue,
          durationMinutes: durationValue,
          note: noteValue === '' ? null : noteValue,
        });
      }
    }

    handleClose();
  }, [
    trimmedTitle,
    placement,
    scheduledDate,
    scheduledTime,
    durationMinutes,
    note,
    isEditMode,
    onUpdate,
    activityToEdit,
    addActivity,
    duplicateCount,
    duplicateInterval,
    handleClose,
  ]);

  const handleDelete = () => {
    if (isEditMode && onDelete) {
      onDelete(activityToEdit.id);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      // Accept on Enter (but not when typing in a textarea)
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        if (target instanceof HTMLTextAreaElement) return;
        if (!canSubmit) return;
        e.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [canSubmit, handleClose, handleSubmit]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--color-overlay)] px-4 pt-[8vh] lg:pt-[20vh] backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      variants={BACKDROP_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div
        className="w-96 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-elevated)] outline-none"
        onClick={(event) => event.stopPropagation()}
        variants={SCALE_FADE_VARIANTS}
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
                const isDisabled = isPlacementLocked && key !== 'date';
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setPlacement(key);
                      if (key !== 'date') {
                        setIsDurationMenuOpen(false);
                      }
                    }}
                    className={`w-full h-10 flex items-center justify-center rounded-lg px-2 sm:px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)] ${
                      isActive
                        ? 'bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)] shadow-sm border-0'
                        : 'border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]'
                    } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {key === 'inbox' && <Circle className="w-4 h-4" />}
                    {key === 'date' && <Square className="w-4 h-4" />}
                    {key === 'later' && <Diamond className="w-4 h-4" />}
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
                    <SimpleDatePicker value={scheduledDate} onChange={setScheduledDate} />
                  </div>
                  <div className="w-full">
                    <SimpleTimePicker value={scheduledTime} onChange={setScheduledTime} />
                  </div>
                </div>

                {showDuration && (
                  <div className="grid grid-cols-2 gap-3">
                    <div ref={durationContainerRef} className="relative w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDurationMenuOpen((prev) => !prev);
                          setIsDuplicateMenuOpen(false);
                        }}
                        className="w-full h-10 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-transparent px-2 sm:px-3 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-focus)] focus:outline-none"
                      >
                        <span className="text-[var(--color-text-subtle)]">Duration:</span>
                        <span>
                          {durationMinutes ? formatDurationLabel(durationMinutes) : 'None'}
                        </span>
                      </button>

                      {isDurationMenuOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-lg">
                          <div className="max-h-56 space-y-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {[15, 30, 45, 60, 90, 120].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => {
                                  setDurationMinutes(mins);
                                  setIsDurationMenuOpen(false);
                                }}
                                className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition"
                              >
                                {formatDurationLabel(mins)}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setDurationMinutes(null);
                                setIsDurationMenuOpen(false);
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-faint)] hover:bg-[var(--color-surface-hover)] transition"
                            >
                              None
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Duplicate Forward Button */}
                    <div ref={duplicateContainerRef} className="relative w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDuplicateMenuOpen((prev) => !prev);
                          setIsDurationMenuOpen(false);
                        }}
                        className="w-full h-10 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-transparent px-2 sm:px-3 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-focus)] focus:outline-none"
                      >
                        <span className="text-[var(--color-text-subtle)]">Duplicate:</span>
                        <span>{duplicateCount > 0 ? `${duplicateCount} copies` : 'None'}</span>
                      </button>

                      {isDuplicateMenuOpen && (
                        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">
                              Copies:
                            </span>
                            <div className="flex items-center gap-2 w-[110px] justify-between">
                              <button
                                type="button"
                                onClick={() => setDuplicateCount(Math.max(0, duplicateCount - 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-md border border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition"
                              >
                                -
                              </button>
                              <span className="flex-1 text-center text-sm">{duplicateCount}</span>
                              <button
                                type="button"
                                onClick={() => setDuplicateCount(Math.min(50, duplicateCount + 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-md border border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">
                              Interval:
                            </span>
                            <div className="flex bg-[var(--color-surface-hover)] p-0.5 rounded-lg border border-[var(--color-border)] w-[110px]">
                              <button
                                type="button"
                                onClick={() => setDuplicateInterval('day')}
                                className={`flex-1 py-1 text-xs font-medium rounded-md transition border ${
                                  duplicateInterval === 'day'
                                    ? 'bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)] shadow-sm border-transparent'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-transparent'
                                }`}
                              >
                                Days
                              </button>
                              <button
                                type="button"
                                onClick={() => setDuplicateInterval('week')}
                                className={`flex-1 py-1 text-xs font-medium rounded-md transition border ${
                                  duplicateInterval === 'week'
                                    ? 'bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)] shadow-sm border-transparent'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-transparent'
                                }`}
                              >
                                Weeks
                              </button>
                            </div>
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
                ref={noteRef}
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
                    ? 'bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)] hover:bg-[var(--color-emphasis-bg-hover)] active:scale-[0.99]'
                    : 'cursor-not-allowed bg-[var(--color-disabled-bg)] text-[var(--color-disabled-text)]'
                }`}
              >
                {isEditMode ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const AddActivityModal = (props: AddActivityModalProps) => {
  return (
    <AnimatePresence>{props.isOpen && <AddActivityModalContent {...props} />}</AnimatePresence>
  );
};

export default AddActivityModal;
