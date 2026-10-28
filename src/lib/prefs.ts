/**
 * Per-device preferences (view, panel width, collapsed lanes...), kept in this
 * browser only, as in the prototype. Storage can be unavailable (private
 * windows, previews), so every read falls back and every write is best-effort.
 */
const PREFIX = 'reacher-pref:';

export function readPref<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Not saved; the app still works for this visit.
  }
}
