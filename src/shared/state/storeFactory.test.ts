import { describe, expect, it, vi } from 'vitest';

import { createHakuStore } from './store';
import { getDefaultListsState, getDefaultSettings } from './types';

describe('createHakuStore', () => {
  it('creates an isolated store using injected infrastructure dependencies', () => {
    const storageRead = vi.spyOn(Storage.prototype, 'getItem');
    const store = createHakuStore({
      initialState: {
        activities: [],
        lists: getDefaultListsState(),
        settings: getDefaultSettings(),
      },
      generateId: () => 'injected-id',
      now: () => '2026-08-09T12:00:00.000Z',
      today: () => '2026-08-09',
    });

    const created = store.getState().addActivity({ title: 'Independent store' });

    expect(created).toMatchObject({
      id: 'injected-id',
      createdAt: '2026-08-09T12:00:00.000Z',
    });
    expect(storageRead).not.toHaveBeenCalled();
  });
});
