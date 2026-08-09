import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Activity } from '../types/activity';
import { useHakuStore } from './browserStore';
import { getDefaultListsState, getDefaultSettings } from './types';

const activity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'activity-1',
  title: 'Activity',
  bucket: 'scheduled',
  date: '2026-08-09',
  time: null,
  durationMinutes: null,
  note: null,
  isDone: false,
  orderIndex: null,
  createdAt: '2026-08-09T08:00:00.000Z',
  updatedAt: '2026-08-09T08:00:00.000Z',
  ...overrides,
});

const resetStore = (activities: Activity[] = []) => {
  useHakuStore.setState({
    activities,
    lists: getDefaultListsState(),
    settings: getDefaultSettings(),
  });
};

describe('Haku activity store', () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetStore();
  });

  it('creates a scheduled activity and normalizes its input', () => {
    const created = useHakuStore.getState().addActivity({
      title: '  Plan the week  ',
      bucket: 'scheduled',
      date: '2026-08-10',
      time: '09:30',
      durationMinutes: 30,
    });

    expect(created).toMatchObject({
      title: 'Plan the week',
      bucket: 'scheduled',
      date: '2026-08-10',
      time: '09:30',
      durationMinutes: 30,
      isDone: false,
    });
    expect(useHakuStore.getState().activities).toEqual([created]);
  });

  it('clears scheduling fields when moving an open activity to a bucket', () => {
    resetStore([activity({ time: '09:30', durationMinutes: 45, orderIndex: 3 })]);

    useHakuStore.getState().moveToLater('activity-1');

    expect(useHakuStore.getState().activities[0]).toMatchObject({
      bucket: 'later',
      date: null,
      time: null,
      durationMinutes: null,
      orderIndex: 3,
    });
  });

  it('schedules an inbox activity for the local action date when completed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T12:00:00.000Z'));
    resetStore([activity({ bucket: 'inbox', date: null, orderIndex: 2 })]);

    useHakuStore.getState().toggleDone('activity-1');

    expect(useHakuStore.getState().activities[0]).toMatchObject({
      bucket: 'scheduled',
      date: '2026-08-09',
      isDone: true,
      orderIndex: null,
    });
  });

  it('reorders only activities belonging to the requested day', () => {
    resetStore([
      activity({ id: 'first', orderIndex: 0 }),
      activity({ id: 'second', orderIndex: 1 }),
      activity({ id: 'other-day', date: '2026-08-10', orderIndex: 7 }),
    ]);

    useHakuStore.getState().reorderInDay('2026-08-09', ['second', 'first']);

    const byId = new Map(useHakuStore.getState().activities.map((item) => [item.id, item]));
    expect(byId.get('second')?.orderIndex).toBe(0);
    expect(byId.get('first')?.orderIndex).toBe(1);
    expect(byId.get('other-day')?.orderIndex).toBe(7);
  });

  it('publishes one state update for an atomic cross-list move', () => {
    resetStore([
      activity({ id: 'moving', orderIndex: 0 }),
      activity({ id: 'source-peer', orderIndex: 1 }),
      activity({
        id: 'later-peer',
        bucket: 'later',
        date: null,
        orderIndex: 0,
      }),
    ]);
    const subscriber = vi.fn();
    const unsubscribe = useHakuStore.subscribe(subscriber);

    useHakuStore.getState().moveActivity({
      activityId: 'moving',
      destination: { bucket: 'later' },
      destinationOrderedIds: ['later-peer', 'moving'],
      sourceOrderedIds: ['source-peer'],
    });

    unsubscribe();
    expect(subscriber).toHaveBeenCalledTimes(1);
    const byId = new Map(useHakuStore.getState().activities.map((item) => [item.id, item]));
    expect(byId.get('moving')).toMatchObject({ bucket: 'later', date: null, orderIndex: 1 });
    expect(byId.get('source-peer')?.orderIndex).toBe(0);
  });
});
