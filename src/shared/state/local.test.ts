import { describe, expect, it } from 'vitest';
import type { Activity } from '../types/activity';
import {
  loadPersistedState,
  migratePersistedState,
  savePersistedState,
  clearPersistedState,
} from './local';
import { STORAGE_KEY } from './types';

const sampleActivity: Activity = {
  id: 'a1',
  title: 'Sample',
  bucket: 'scheduled',
  date: '2026-01-02',
  time: '09:00',
  durationMinutes: 30,
  note: null,
  isDone: false,
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const validV1 = {
  version: 1 as const,
  activities: [sampleActivity],
  lists: { version: 1 },
  settings: { weekStart: 'monday' as const, themeMode: 'system' as const },
};

describe('shared/state/local', () => {
  it('migrates valid v1 data', () => {
    const migrated = migratePersistedState(validV1);

    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(1);
    expect(migrated?.activities).toHaveLength(1);
  });

  it('migrates export snapshot format without schemaVersion', () => {
    const exported = {
      app: 'haku',
      version: '1.0.1',
      exportedAt: '2026-01-01T00:00:00.000Z',
      activities: [sampleActivity],
      lists: { version: 1 },
      settings: { weekStart: 'monday' as const, themeMode: 'light' as const },
    };

    const migrated = migratePersistedState(exported);

    expect(migrated).not.toBeNull();
    expect(migrated?.settings.themeMode).toBe('light');
  });

  it('rejects malformed activity payloads', () => {
    const invalid = {
      version: 1,
      activities: [{ ...sampleActivity, bucket: 'unknown' }],
      lists: { version: 1 },
      settings: { weekStart: 'monday', themeMode: 'system' },
    };

    expect(migratePersistedState(invalid)).toBeNull();
  });

  it('round-trips persisted state through localStorage', () => {
    savePersistedState(validV1);

    const loaded = loadPersistedState();

    expect(loaded).toEqual(validV1);

    clearPersistedState();
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null for invalid JSON in storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');

    expect(loadPersistedState()).toBeNull();
  });
});
