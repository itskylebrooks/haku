import { describe, expect, it } from 'vitest';

import { createPersistedStateSnapshot } from './export';
import { CURRENT_SCHEMA_VERSION } from './types';

describe('state export', () => {
  it('identifies both the app and persisted schema versions', () => {
    const snapshot = createPersistedStateSnapshot();

    expect(snapshot.app).toBe('haku');
    expect(snapshot.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(snapshot.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
