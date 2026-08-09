const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const padTwoDigits = (value: number): string => String(value).padStart(2, '0');

/** Formats a Date using the user's local calendar day. */
export const formatLocalCalendarDate = (date: Date): string =>
  `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`;

export const todayLocal = (now: Date = new Date()): string => formatLocalCalendarDate(now);

/**
 * Parses a calendar date independently of the browser timezone.
 * UTC is used only as a stable arithmetic representation of a date-only value.
 */
export const parseCalendarDate = (value: string): Date | null => {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

export const isCalendarDate = (value: unknown): value is string =>
  typeof value === 'string' && parseCalendarDate(value) !== null;

const formatUtcCalendarDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${padTwoDigits(date.getUTCMonth() + 1)}-${padTwoDigits(date.getUTCDate())}`;

export const addCalendarDays = (value: string, days: number): string => {
  const date = parseCalendarDate(value);
  if (!date) return value;

  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcCalendarDate(date);
};

export const getCalendarWeekStart = (
  value: string,
  weekStartsOn: 'monday' | 'sunday' = 'monday',
): string => {
  const date = parseCalendarDate(value);
  if (!date) return value;

  const dayOfWeek = date.getUTCDay();
  const offset = weekStartsOn === 'sunday' ? dayOfWeek : (dayOfWeek + 6) % 7;
  return addCalendarDays(value, -offset);
};

export const getCalendarWeekDates = (weekStartDate: string): string[] => {
  if (!isCalendarDate(weekStartDate)) return [];
  return Array.from({ length: 7 }, (_, dayOffset) => addCalendarDays(weekStartDate, dayOffset));
};
