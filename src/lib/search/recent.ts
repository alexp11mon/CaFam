import { MAX_RECENT } from "./limits";
import { normalize } from "./normalize";

// The last searches live only on this device (spec 039 RF-9, plan D5).
export const RECENT_KEY = "cafam-recent-search";

export function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter((q): q is string => typeof q === "string")
          .slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Blocked storage: the list is a convenience.
  }
}

/** Puts a search first, without repeats, 5 at most. */
export function addRecent(query: string): string[] {
  const text = query.trim();
  if (!text) return readRecent();
  const key = normalize(text);
  const list = [
    text,
    ...readRecent().filter((q) => normalize(q) !== key),
  ].slice(0, MAX_RECENT);
  write(list);
  return list;
}

export function removeRecent(query: string): string[] {
  const list = readRecent().filter((q) => q !== query);
  write(list);
  return list;
}
