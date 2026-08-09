import { useMemo, useState } from 'react';

import type { NewActivityInput } from '@/shared/domain/activity';
import type { Activity, Bucket } from '@/shared/types/activity';
import { addCalendarDays, todayLocal } from '@/shared/utils/calendarDate';

export type ActivityPlacementOption = 'inbox' | 'date' | 'later';
export type ActivityFormMode = 'create' | 'edit';
export type DuplicateInterval = 'day' | 'week';

export interface ActivityFormValues {
  title: string;
  placement: ActivityPlacementOption;
  scheduledDate: string | null;
  scheduledTime: string | null;
  durationMinutes: number | null;
  duplicateCount: number;
  duplicateInterval: DuplicateInterval;
  note: string;
}

interface UseActivityFormOptions {
  mode: ActivityFormMode;
  activity?: Activity;
  initialTitle?: string;
  initialPlacement?: Bucket;
  defaultDate?: string;
}

export interface ActivitySubmission {
  primary: NewActivityInput;
  duplicates: NewActivityInput[];
}

const getInitialPlacement = ({
  mode,
  activity,
  initialPlacement,
}: UseActivityFormOptions): ActivityPlacementOption => {
  if (mode === 'edit' && activity) {
    if (activity.bucket === 'scheduled') return 'date';
    return activity.bucket;
  }
  return initialPlacement === 'scheduled' ? 'date' : (initialPlacement ?? 'inbox');
};

export const buildActivitySubmission = (values: ActivityFormValues): ActivitySubmission | null => {
  const title = values.title.trim();
  if (!title) return null;

  let bucket: Bucket = 'inbox';
  let date: string | null = null;
  let time: string | null = null;
  let durationMinutes: number | null = null;

  if (values.placement === 'date') {
    if (!values.scheduledDate) return null;
    bucket = 'scheduled';
    date = values.scheduledDate;
    time = values.scheduledTime;
    durationMinutes = time === null ? null : values.durationMinutes;
  } else if (values.placement === 'later') {
    bucket = 'later';
  }

  const note = values.note.trim() || null;
  const primary: NewActivityInput = { title, bucket, date, time, durationMinutes, note };
  const duplicates =
    date === null
      ? []
      : Array.from({ length: values.duplicateCount }, (_, index): NewActivityInput => {
          const multiplier = index + 1;
          const daysToAdd = values.duplicateInterval === 'week' ? multiplier * 7 : multiplier;
          return { ...primary, date: addCalendarDays(date, daysToAdd) };
        });

  return { primary, duplicates };
};

export const useActivityForm = (options: UseActivityFormOptions) => {
  const isEditMode = options.mode === 'edit' && options.activity !== undefined;
  const activity = isEditMode ? options.activity : undefined;
  const [title, setTitle] = useState(() => activity?.title ?? options.initialTitle ?? '');
  const [placement, setPlacement] = useState<ActivityPlacementOption>(() =>
    getInitialPlacement(options),
  );
  const [scheduledDate, setScheduledDate] = useState<string | null>(() =>
    activity && activity.date !== null ? activity.date : (options.defaultDate ?? todayLocal()),
  );
  const [scheduledTime, setScheduledTimeState] = useState<string | null>(
    () => activity?.time ?? null,
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    () => activity?.durationMinutes ?? null,
  );
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [duplicateInterval, setDuplicateInterval] = useState<DuplicateInterval>('day');
  const [note, setNote] = useState(() => activity?.note ?? '');
  const [showNote, setShowNote] = useState(() => Boolean(activity?.note));

  const trimmedTitle = useMemo(() => title.trim(), [title]);
  const isDatePlacement = placement === 'date';
  const canSubmit = Boolean(trimmedTitle) && (!isDatePlacement || Boolean(scheduledDate));

  const setScheduledTime = (nextTime: string | null) => {
    setScheduledTimeState(nextTime);
    if (nextTime === null) {
      setDurationMinutes(null);
      setDuplicateCount(0);
      setDuplicateInterval('day');
    }
  };

  const createSubmission = () =>
    buildActivitySubmission({
      title,
      placement,
      scheduledDate,
      scheduledTime,
      durationMinutes,
      duplicateCount,
      duplicateInterval,
      note,
    });

  return {
    isEditMode,
    isPlacementLocked: Boolean(activity?.isDone),
    title,
    setTitle,
    placement,
    setPlacement,
    scheduledDate,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    durationMinutes,
    setDurationMinutes,
    duplicateCount,
    setDuplicateCount,
    duplicateInterval,
    setDuplicateInterval,
    note,
    setNote,
    showNote,
    setShowNote,
    trimmedTitle,
    isDatePlacement,
    canSubmit,
    createSubmission,
  };
};
