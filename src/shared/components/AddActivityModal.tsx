import { useEffect, useMemo, useState } from "react";
import type { Bucket } from "../types/activity";
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
  const [note, setNote] = useState<string>("");
  const [showNote, setShowNote] = useState<boolean>(false);

  const trimmedTitle = useMemo(() => title.trim(), [title]);
  const isDatePlacement = placement === "date";

  const resetForm = () => {
    setTitle(initialTitle ?? "");
    setPlacement(defaultPlacement);
    setScheduledDate(todayIso());
    setScheduledTime(null);
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

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (!trimmedTitle) return;

    let bucket: Bucket = "inbox";
    let dateValue: string | null = null;
    let timeValue: string | null = null;

    if (placement === "date") {
      bucket = "scheduled";
      dateValue = scheduledDate || todayIso();
      timeValue = scheduledTime;
    } else if (placement === "later") {
      bucket = "later";
    }

    const noteValue = note.trim();

    addActivity({
      title: trimmedTitle,
      bucket,
      date: dateValue,
      time: timeValue,
      durationMinutes: null,
      note: noteValue === "" ? null : noteValue,
    });

    handleClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm sm:py-12"
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
                    onClick={() => setPlacement(key)}
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
                className="w-full rounded-lg border border-gray-200/80 bg-transparent px-3 py-2 text-sm text-gray-900 shadow-none outline-none ring-0 transition focus:border-gray-400 dark:border-gray-700/80 dark:text-gray-100 dark:focus:border-gray-500"
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
              disabled={!trimmedTitle}
              onClick={handleSubmit}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:focus-visible:outline-gray-500 ${
                trimmedTitle
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
