import type { ReadOnlyReason } from "@/lib/sync/read-only";

// Spec 036, RF-18 to RF-23: the calendar named in the chat, decided by the
// server and never by the model (plan D1). Pure.

export interface MatchableCalendar {
  id: string;
  name: string;
  /** canWriteEvents of spec 009 (RF-18). */
  writable: boolean;
  /** Why it is read-only: a reader, or the provider (readOnlyReason). */
  reason: "viewer" | ReadOnlyReason | null;
}

export type CalendarMatch<T extends MatchableCalendar = MatchableCalendar> =
  | { status: "ok"; calendar: T }
  | { status: "ambiguous"; options: string[] }
  | { status: "not_found"; name: string; options: string[] }
  | {
      status: "read_only";
      name: string;
      reason: NonNullable<MatchableCalendar["reason"]>;
      options: string[];
    }
  | { status: "need_calendar"; options: string[] }
  | { status: "no_writable" };

// What people say around a calendar's name: "el calendario de la uni".
const FILLERS = new Set([
  "el",
  "la",
  "los",
  "las",
  "de",
  "del",
  "mi",
  "mis",
  "en",
  "calendario",
  "calendarios",
]);

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[«»"'“”]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const significant = (text: string) =>
  normalize(text)
    .filter((word) => !FILLERS.has(word))
    .join(" ");

const sortedNames = (calendars: readonly MatchableCalendar[]) =>
  calendars
    .map((calendar) => calendar.name)
    .sort((a, b) => a.localeCompare(b, "es"));

/** Exact names first, then names that contain what was said, or the reverse. */
function candidates<T extends MatchableCalendar>(
  query: string,
  calendars: readonly T[],
): T[] {
  const full = normalize(query).join(" ");
  const exact = calendars.filter(
    (calendar) =>
      normalize(calendar.name).join(" ") === full ||
      significant(calendar.name) === query,
  );
  if (exact.length > 0) return exact;
  return calendars.filter((calendar) => {
    const name = significant(calendar.name);
    return (
      name.length > 0 &&
      (name.includes(query) || (name.length >= 3 && query.includes(name)))
    );
  });
}

export function matchCalendar<T extends MatchableCalendar>(
  named: string | null | undefined,
  calendars: readonly T[],
): CalendarMatch<T> {
  const writable = calendars.filter((calendar) => calendar.writable);
  if (writable.length === 0) return { status: "no_writable" };
  const options = sortedNames(writable);
  const query = significant(named ?? "");
  if (!query) {
    return writable.length === 1
      ? { status: "ok", calendar: writable[0]! }
      : { status: "need_calendar", options };
  }

  const found = candidates(query, writable);
  if (found.length === 1) return { status: "ok", calendar: found[0]! };
  if (found.length > 1) {
    return { status: "ambiguous", options: sortedNames(found) };
  }
  const readOnly = candidates(
    query,
    calendars.filter((calendar) => !calendar.writable),
  );
  if (readOnly.length === 1) {
    return {
      status: "read_only",
      name: readOnly[0]!.name,
      reason: readOnly[0]!.reason ?? "viewer",
      options,
    };
  }
  return { status: "not_found", name: named!.trim(), options };
}
