import { describe, expect, it } from 'vitest';

import { buildActivitySubmission, type ActivityFormValues } from './activityForm';

const values = (overrides: Partial<ActivityFormValues> = {}): ActivityFormValues => ({
  title: ' Plan week ',
  placement: 'date',
  scheduledDate: '2026-08-09',
  scheduledTime: '09:00',
  durationMinutes: 30,
  duplicateCount: 0,
  duplicateInterval: 'day',
  note: ' Notes ',
  ...overrides,
});

describe('activity form submission', () => {
  it('normalizes the primary activity input', () => {
    expect(buildActivitySubmission(values())?.primary).toEqual({
      title: 'Plan week',
      bucket: 'scheduled',
      date: '2026-08-09',
      time: '09:00',
      durationMinutes: 30,
      note: 'Notes',
    });
  });

  it('builds date-only duplicate inputs at the selected interval', () => {
    const result = buildActivitySubmission(
      values({ duplicateCount: 2, duplicateInterval: 'week' }),
    );

    expect(result?.duplicates.map(({ date }) => date)).toEqual(['2026-08-16', '2026-08-23']);
  });

  it('clears scheduling fields for unscheduled placements', () => {
    expect(buildActivitySubmission(values({ placement: 'later' }))?.primary).toMatchObject({
      bucket: 'later',
      date: null,
      time: null,
      durationMinutes: null,
    });
  });

  it('rejects incomplete submissions', () => {
    expect(buildActivitySubmission(values({ title: ' ' }))).toBeNull();
    expect(buildActivitySubmission(values({ scheduledDate: null }))).toBeNull();
  });
});
