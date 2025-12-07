/**
 * Persistence types for Haku app state
 * 
 * This module defines the versioned schema for persisted data.
 * When the schema changes, create a new version and add migration logic.
 */

import type { Activity } from "../types/activity";

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

export type WeekStart = "sunday" | "monday";
export type ThemeMode = "system" | "light" | "dark";

export interface Settings {
  weekStart: WeekStart;
  themeMode: ThemeMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lists State (for future use with list-based organization)
// ─────────────────────────────────────────────────────────────────────────────

export interface ListsState {
  // Placeholder for future list-based features
  // e.g., custom lists, tags, projects, etc.
  version: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persisted State Versions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Version 1 of the persisted state schema.
 */
export interface PersistedStateV1 {
  version: 1;
  activities: Activity[];
  lists: ListsState;
  settings: Settings;
}

/**
 * Union type for all persisted state versions.
 * Extend this as new versions are added: PersistedStateV1 | PersistedStateV2 | ...
 */
export type PersistedState = PersistedStateV1;

/**
 * Current version number for new data
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * localStorage key for persisted state
 */
export const STORAGE_KEY = "haku:v1:state";

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export function getDefaultSettings(): Settings {
  return {
    weekStart: "monday",
    themeMode: "system",
  };
}

export function getDefaultListsState(): ListsState {
  return {
    version: 1,
  };
}

export function getDefaultActivities(): Activity[] {
  return [];
}

export function getDefaultPersistedState(): PersistedState {
  return {
    version: CURRENT_SCHEMA_VERSION,
    activities: getDefaultActivities(),
    lists: getDefaultListsState(),
    settings: getDefaultSettings(),
  };
}
