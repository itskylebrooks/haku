import { describe, expect, it } from 'vitest';

import {
  addCalendarDays,
  formatLocalCalendarDate,
  getCalendarWeekDates,
  getCalendarWeekStart,
  isCalendarDate,
  todayLocal,
} from './calendarDate';

describe('calendarDate', () => {
  it('formats the local day rather than the UTC day', () => {
    const localLateEvening = new Date(2026, 7, 9, 23, 30);

    expect(formatLocalCalendarDate(localLateEvening)).toBe('2026-08-09');
    expect(todayLocal(localLateEvening)).toBe('2026-08-09');
  });

  it('validates real calendar dates', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-8-09')).toBe(false);
  });

  it('performs date-only arithmetic across month and year boundaries', () => {
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('builds Monday and Sunday calendar weeks', () => {
    expect(getCalendarWeekStart('2026-08-09', 'monday')).toBe('2026-08-03');
    expect(getCalendarWeekStart('2026-08-09', 'sunday')).toBe('2026-08-09');
    expect(getCalendarWeekDates('2026-08-03')).toHaveLength(7);
    expect(getCalendarWeekDates('invalid')).toEqual([]);
  });
});
