import { describe, expect, it } from 'vitest';

import type { Activity } from '../types/activity';
import {
  createActivityEntity,
  isPersistedActivity,
  isPersistedActivityCollection,
  moveActivityInCollection,
  updateActivityEntity,
} from './activity';

const validActivity: Activity = {
  id: 'activity-1',
  title: 'Plan week',
  bucket: 'scheduled',
  date: '2026-08-09',
  time: '09:00',
  durationMinutes: 30,
  note: null,
  isDone: false,
  orderIndex: 0,
  createdAt: '2026-08-09T08:00:00.000Z',
  updatedAt: '2026-08-09T08:00:00.000Z',
};

const context = {
  id: 'new-id',
  now: '2026-08-09T10:00:00.000Z',
  today: '2026-08-09',
};

describe('activity domain', () => {
  it('creates normalized activities at the domain boundary', () => {
    expect(
      createActivityEntity(
        {
          title: '  New activity ',
          bucket: 'scheduled',
          date: 'not-a-date',
          time: '29:00',
          durationMinutes: 17,
        },
        context,
      ),
    ).toMatchObject({
      title: 'New activity',
      date: '2026-08-09',
      time: null,
      durationMinutes: null,
    });
  });

  it('preserves activity invariants while applying updates', () => {
    const updated = updateActivityEntity(
      validActivity,
      { bucket: 'later', date: '2027-01-01', time: '10:00', durationMinutes: 45 },
      context,
    );

    expect(updated).toMatchObject({
      bucket: 'later',
      date: null,
      time: null,
      durationMinutes: null,
    });
  });

  it('rejects semantically invalid persisted activities', () => {
    expect(isPersistedActivity(validActivity)).toBe(true);
    expect(isPersistedActivity({ ...validActivity, date: '2026-02-29' })).toBe(false);
    expect(isPersistedActivity({ ...validActivity, time: '25:00' })).toBe(false);
    expect(isPersistedActivity({ ...validActivity, durationMinutes: -30 })).toBe(false);
    expect(
      isPersistedActivity({
        ...validActivity,
        bucket: 'inbox',
        date: '2026-08-09',
      }),
    ).toBe(false);
  });

  it('rejects duplicate IDs in persisted collections', () => {
    expect(isPersistedActivityCollection([validActivity, { ...validActivity }])).toBe(false);
  });

  it('moves and reorders an activity in one collection transaction', () => {
    const sourcePeer = { ...validActivity, id: 'source-peer', orderIndex: 1 };
    const destinationPeer = {
      ...validActivity,
      id: 'destination-peer',
      bucket: 'later' as const,
      date: null,
      time: null,
      durationMinutes: null,
      orderIndex: 0,
    };

    const result = moveActivityInCollection(
      [validActivity, sourcePeer, destinationPeer],
      {
        activityId: validActivity.id,
        destination: { bucket: 'later' },
        destinationOrderedIds: [destinationPeer.id, validActivity.id],
        sourceOrderedIds: [sourcePeer.id],
      },
      context,
    );

    expect(result.find(({ id }) => id === validActivity.id)).toMatchObject({
      bucket: 'later',
      date: null,
      orderIndex: 1,
    });
    expect(result.find(({ id }) => id === sourcePeer.id)?.orderIndex).toBe(0);
    expect(result.find(({ id }) => id === destinationPeer.id)?.orderIndex).toBe(0);
  });
});
