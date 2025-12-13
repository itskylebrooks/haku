/**
 * Local Storage Module
 * 
 * Handles reading, writing, clearing, and migrating persisted state
 * from localStorage. All operations are guarded with try/catch to
 * prevent app crashes when storage is unavailable or full.
 */

import type { PersistedState, PersistedStateV1, ListsState } from "./types";
import { STORAGE_KEY } from "./types";
import type { Activity, Bucket } from "../types/activity";

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidBucket(value: unknown): value is Bucket {
  return value === "inbox" || value === "later" || value === "scheduled";
}

function isValidActivity(value: unknown): value is Activity {
  if (!isObject(value)) return false;

  const v = value as Record<string, unknown>;

  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    isValidBucket(v.bucket) &&
    (v.date === null || typeof v.date === "string") &&
    (v.time === null || typeof v.time === "string") &&
    (v.durationMinutes === null || typeof v.durationMinutes === "number") &&
    (v.note === null || typeof v.note === "string") &&
    typeof v.isDone === "boolean" &&
    (v.orderIndex === null || typeof v.orderIndex === "number") &&
    typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string"
  );
}

function isValidActivitiesArray(value: unknown): value is Activity[] {
  return Array.isArray(value) && value.every(isValidActivity);
}

function isValidSettings(value: unknown): boolean {
  if (!isObject(value)) return false;

  const v = value as Record<string, unknown>;

  return (
    (v.weekStart === "sunday" || v.weekStart === "monday") &&
    (v.themeMode === "system" || v.themeMode === "light" || v.themeMode === "dark")
  );
}

function isValidListsState(value: unknown): boolean {
  if (!isObject(value)) return false;

  const v = value as Record<string, unknown>;

  return typeof v.version === "number";
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates and migrates raw data to the current schema version.
 * 
 * Structure the migration as a switch on raw.version to make adding
 * future migrations straightforward (e.g., V1 → V2 → V3).
 */
export function migratePersistedState(raw: unknown): PersistedState | null {
  if (!isObject(raw)) {
    return null;
  }

  const version = (raw as Record<string, unknown>).version;

  switch (version) {
    case 1:
      return migrateFromV1(raw);

    // Future migrations:
    // case 2:
    //   return migrateFromV2(raw);

    default:
      // Unknown version or missing version field
      return null;
  }
}

/**
 * Validates and returns a V1 state object.
 * For V1, we just validate the shape since it's the current version.
 */
function migrateFromV1(raw: unknown): PersistedStateV1 | null {
  if (!isObject(raw)) return null;

  const data = raw as Record<string, unknown>;

  // Validate version
  if (data.version !== 1) return null;

  // Validate activities
  if (!isValidActivitiesArray(data.activities)) return null;

  // Validate settings
  if (!isValidSettings(data.settings)) return null;

  // Validate lists (with fallback for backward compatibility)
  const lists = data.lists;
  if (lists !== undefined && !isValidListsState(lists)) return null;

  return {
    version: 1,
    activities: data.activities as Activity[],
    lists: isObject(lists) ? (lists as unknown as ListsState) : { version: 1 },
    settings: data.settings as PersistedStateV1["settings"],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads persisted state from localStorage.
 * 
 * @returns The validated PersistedState, or null if:
 *   - No data exists
 *   - Data is corrupted
 *   - Migration fails
 *   - localStorage is unavailable
 */
export function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return migratePersistedState(parsed);
  } catch {
    // JSON parse error or localStorage unavailable
    return null;
  }
}

/**
 * Saves persisted state to localStorage.
 * 
 * Fails silently on quota exceeded or other errors.
 */
export function savePersistedState(state: PersistedState): void {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Quota exceeded or localStorage unavailable - fail silently
    console.warn("[Haku] Failed to save state to localStorage");
  }
}

/**
 * Removes persisted state from localStorage.
 */
export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable - fail silently
    console.warn("[Haku] Failed to clear localStorage");
  }
}

/**
 * Checks if localStorage is available and writable.
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = "__haku_storage_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
