import { describe, expect, it } from 'vitest';

import type { Activity } from '@/shared/types/activity';
import { getDayViewData } from './daySelectors';

const activity = (id: string, overrides: Partial<Activity> = {}): Activity => ({
  id,
  title: id,
  bucket: 'scheduled',
  date: '2026-08-09',
  time: null,
  durationMinutes: null,
  note: null,
  isDone: false,
  orderIndex: null,
  createdAt: `2026-08-09T08:00:0${id.length}.000Z`,
  updatedAt: '2026-08-09T08:00:00.000Z',
  ...overrides,
});

describe('getDayViewData', () => {
  it('separates overdue, anchored, and flexible activities and sorts each group', () => {
    const result = getDayViewData(
      [
        activity('later-flexible', { orderIndex: 2 }),
        activity('earlier-flexible', { orderIndex: 0 }),
        activity('late-anchor', { time: '16:00' }),
        activity('early-anchor', { time: '08:30' }),
        activity('overdue', { date: '2026-08-08' }),
        activity('done-overdue', { date: '2026-08-07', isDone: true }),
        activity('inbox', { bucket: 'inbox', date: null }),
      ],
      '2026-08-09',
    );

    expect(result.overdue.map(({ id }) => id)).toEqual(['overdue']);
    expect(result.todayAnchored.map(({ id }) => id)).toEqual(['early-anchor', 'late-anchor']);
    expect(result.todayFlexible.map(({ id }) => id)).toEqual([
      'earlier-flexible',
      'later-flexible',
    ]);
  });
});
