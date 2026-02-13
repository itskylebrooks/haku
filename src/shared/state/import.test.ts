import { beforeEach, describe, expect, it } from 'vitest';
import type { Activity } from '../types/activity';
import { useHakuStore } from './store';
import { importStateFromJson } from './import';
import { loadPersistedState, clearPersistedState } from './local';
import { getDefaultActivities, getDefaultListsState, getDefaultSettings } from './types';

const importedActivity: Activity = {
  id: 'imported-1',
  title: 'Imported',
  bucket: 'scheduled',
  date: '2026-02-01',
  time: null,
  durationMinutes: null,
  note: 'from backup',
  isDone: false,
  orderIndex: null,
  createdAt: '2026-02-01T01:00:00.000Z',
  updatedAt: '2026-02-01T01:00:00.000Z',
};

const resetStore = () => {
  useHakuStore.setState({
    activities: getDefaultActivities(),
    lists: getDefaultListsState(),
    settings: getDefaultSettings(),
  });
  clearPersistedState();
};

describe('shared/state/import', () => {
  beforeEach(() => {
    resetStore();
  });

  it('rejects invalid JSON', () => {
    const result = importStateFromJson('{oops');

    expect(result).toEqual({ ok: false, error: 'Invalid JSON format' });
  });

  it('rejects incompatible payloads', () => {
    const result = importStateFromJson(JSON.stringify({ version: 999, activities: [] }));

    expect(result).toEqual({ ok: false, error: 'Invalid or incompatible backup file' });
  });

  it('hydrates store and persistence on success', () => {
    const snapshot = {
      version: 1,
      activities: [importedActivity],
      lists: { version: 1 },
      settings: { weekStart: 'sunday', themeMode: 'dark' },
    };

    const result = importStateFromJson(JSON.stringify(snapshot));

    expect(result).toEqual({ ok: true });

    const state = useHakuStore.getState();
    expect(state.activities).toEqual([importedActivity]);
    expect(state.settings).toEqual({ weekStart: 'sunday', themeMode: 'dark' });

    const persisted = loadPersistedState();
    expect(persisted).not.toBeNull();
    expect(persisted?.activities).toEqual([importedActivity]);
  });
});
