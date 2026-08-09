import { describe, expect, it } from 'vitest';

import type { Activity } from '@/shared/types/activity';
import { getWeekActivities, getWeekDates, getWeekStartDate } from './weekSelectors';

const activity = (id: string, overrides: Partial<Activity> = {}): Activity => ({
  id,
  title: id,
  bucket: 'scheduled',
  date: '2026-08-03',
  time: null,
  durationMinutes: null,
  note: null,
  isDone: false,
  orderIndex: null,
  createdAt: '2026-08-03T08:00:00.000Z',
  updatedAt: '2026-08-03T08:00:00.000Z',
  ...overrides,
});

describe('week selectors', () => {
  it('calculates Monday and Sunday week boundaries', () => {
    expect(getWeekStartDate('2026-08-09', 'monday')).toBe('2026-08-03');
    expect(getWeekStartDate('2026-08-09', 'sunday')).toBe('2026-08-09');
    expect(getWeekDates('2026-08-03')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
  });

  it('groups only scheduled activities in the week and preserves ordering rules', () => {
    const grouped = getWeekActivities(
      [
        activity('second', { orderIndex: 1 }),
        activity('first', { orderIndex: 0 }),
        activity('outside', { date: '2026-08-10' }),
        activity('inbox', { bucket: 'inbox', date: null }),
      ],
      '2026-08-03',
    );

    expect(grouped['2026-08-03'].map(({ id }) => id)).toEqual(['first', 'second']);
    expect(
      Object.values(grouped)
        .flat()
        .map(({ id }) => id),
    ).not.toContain('outside');
    expect(
      Object.values(grouped)
        .flat()
        .map(({ id }) => id),
    ).not.toContain('inbox');
  });
});
