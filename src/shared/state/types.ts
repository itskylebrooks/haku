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
  // Create simple helper to compute today/yesterday/tomorrow ISO dates (YYYY-MM-DD)
  const offsetIsoDate = (offsetDays: number): string => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  const now = new Date().toISOString();
  const today = offsetIsoDate(0);
  const yesterday = offsetIsoDate(-1);
  const tomorrow = offsetIsoDate(1);

  // Seed activities to provide a gentle first-run experience.
  // IDs are deterministic to make it easy to reason about these seeded items.
  return [
    // Today (Day page) - anchored time example
    {
      id: "seed_plan_week",
      title: "Plan this week in Haku",
      bucket: "scheduled",
      date: today,
      time: null,
      durationMinutes: null,
      note: "Open me to see how an activity works.",
      isDone: false,
      orderIndex: null,
      createdAt: now,
      updatedAt: now,
    },

    // Today (Day page) - flexible item you can drag
    {
      id: "seed_drag_week",
      title: "Drag me to another day on the Week page",
      bucket: "scheduled",
      date: today,
      time: null,
      durationMinutes: null,
      note: null,
      isDone: false,
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    },

    // Today (Day page) - editable placeholder
    {
      id: "seed_replace_first",
      title: "Replace me with your first real activity",
      bucket: "scheduled",
      date: today,
      time: "15:00",
      durationMinutes: null,
      note: null,
      isDone: false,
      orderIndex: 1,
      createdAt: now,
      updatedAt: now,
    },

    // Inbox - captured ideas
    {
      id: "seed_inbox_example",
      title: "This is Inbox: drop any idea here",
      bucket: "inbox",
      date: null,
      time: null,
      durationMinutes: null,

      note: "Try moving me to a day.",
      isDone: false,
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    },

    {
      id: "seed_inbox_capture",
      title: "Capture one thing you want to do this week",
      bucket: "inbox",
      date: null,
      time: null,
      durationMinutes: null,
      note: null,
      isDone: false,
      orderIndex: 1,
      createdAt: now,
      updatedAt: now,
    },

    // Later (Someday)
    {
      id: "seed_someday_activity",
      title: "A someday activity",
      bucket: "later",
      date: null,
      time: null,
      durationMinutes: null,

      note: "Move me back to a day when it becomes relevant.",
      isDone: false,
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    },

    // Overdue (yesterday)
    {
      id: "seed_overdue_example",
      title: "Example overdue activity",
      bucket: "scheduled",
      date: yesterday,
      time: null,
      durationMinutes: null,

      note: "Change to yesterday to see where I live. Mark me done when you're ready.",
      isDone: false,
      orderIndex: null,
      createdAt: now,
      updatedAt: now,
    },

    // Pre-fill Tomorrow - teaches quick rescheduling
    {
      id: "seed_move_tomorrow",
      title: "Move me to Today or Later",
      bucket: "scheduled",
      date: tomorrow,
      time: null,
      durationMinutes: null,
      note: null,
      isDone: false,
      orderIndex: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function getDefaultPersistedState(): PersistedState {
  return {
    version: CURRENT_SCHEMA_VERSION,
    activities: getDefaultActivities(),
    lists: getDefaultListsState(),
    settings: getDefaultSettings(),
  };
}
