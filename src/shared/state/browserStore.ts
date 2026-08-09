import { clearPersistedState, loadPersistedState } from './local';
import { createHakuStore, type HakuDataState } from './store';
import type { PersistedState } from './types';
import {
  CURRENT_SCHEMA_VERSION,
  getDefaultActivities,
  getDefaultListsState,
  getDefaultSettings,
} from './types';

const getInitialBrowserState = (): HakuDataState => {
  const persisted = loadPersistedState();
  if (persisted) {
    return {
      activities: persisted.activities,
      lists: persisted.lists,
      settings: persisted.settings,
    };
  }

  return {
    activities: getDefaultActivities(),
    lists: getDefaultListsState(),
    settings: getDefaultSettings(),
  };
};

export const useHakuStore = createHakuStore({
  initialState: getInitialBrowserState(),
  onReset: clearPersistedState,
});

export const createPersistedStateFromStore = (): PersistedState => {
  const state = useHakuStore.getState();
  return {
    version: CURRENT_SCHEMA_VERSION,
    activities: state.activities,
    lists: state.lists,
    settings: state.settings,
  };
};
