import { describe, expect, it } from 'vitest';

import type { Activity } from '../types/activity';
import {
  computeAnchoredPreviewOrder,
  computePlaceholderPreview,
  DRAG_PLACEHOLDER_ID,
} from './activityOrdering';

const activity = (id: string, time: string | null): Activity => ({
  id,
  title: id,
  bucket: 'scheduled',
  date: '2026-08-09',
  time,
  durationMinutes: null,
  note: null,
  isDone: false,
  orderIndex: null,
  createdAt: '2026-08-09T08:00:00.000Z',
  updatedAt: '2026-08-09T08:00:00.000Z',
});

describe('activity ordering', () => {
  it('moves flexible activities while anchored activities stay time-sorted', () => {
    const result = computeAnchoredPreviewOrder(
      [
        activity('flex-a', null),
        activity('late', '17:00'),
        activity('early', '09:00'),
        activity('flex-b', null),
      ],
      'flex-b',
      0,
    );

    expect(result.map(({ id }) => id)).toEqual(['flex-b', 'flex-a', 'early', 'late']);
  });

  it('uses a placeholder when previewing an activity from another list', () => {
    const result = computePlaceholderPreview(
      [activity('existing', null)],
      activity('incoming', null),
      1,
    );

    expect(result.map(({ id }) => id)).toEqual(['existing', DRAG_PLACEHOLDER_ID]);
  });
});
