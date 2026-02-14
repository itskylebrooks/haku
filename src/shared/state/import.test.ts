import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '../types/activity';
import { useHakuStore } from './store';
import { importStateFromJson } from './import';
import * as local from './local';
import { getDefaultActivities, getDefaultListsState, getDefaultSettings, STORAGE_KEY } from './types';

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
  local.clearPersistedState();
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

    const persisted = local.loadPersistedState();
    expect(persisted).not.toBeNull();
    expect(persisted?.activities).toEqual([importedActivity]);
  });

  it('rolls back store and storage when persistence fails', () => {
    const initial = {
      activities: [importedActivity],
      lists: { version: 1 },
      settings: { weekStart: 'monday' as const, themeMode: 'system' as const },
    };
    const initialPersisted = { version: 1, ...initial };

    useHakuStore.setState(initial);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialPersisted));

    const incoming = {
      version: 1,
      activities: [{ ...importedActivity, id: 'incoming-2', title: 'Incoming' }],
      lists: { version: 1 },
      settings: { weekStart: 'sunday', themeMode: 'dark' },
    };

    vi.spyOn(local, 'savePersistedState').mockReturnValue(false);

    const result = importStateFromJson(JSON.stringify(incoming));

    expect(result).toEqual({ ok: false, error: 'Failed to save to localStorage' });
    expect(useHakuStore.getState().activities).toEqual(initial.activities);
    expect(useHakuStore.getState().settings).toEqual(initial.settings);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(initialPersisted));
  });
});
