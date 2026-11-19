import { zonedLocalToUtc } from "@/lib/calendar/time-zone";
import type { IcsOccurrence, IcsTime } from "./parse-ics";

// Converts what `parse-ics` read into the rows `import_calendar` stores
// (RF-13..RF-19, RF-21, RF-29). Pure: no network, no database.

export interface EventRow {
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  /** UID, or UID#<instant> in a repetition (spec 044 RF-2). */
  external_id: string;
  /** The TZID of the file, if any (spec 045 RF-10). */
  start_tz?: string | null;
  end_tz?: string | null;
}

const DAY_MS = 86_400_000;
export const NO_TITLE = "(Sin título)";
// Limits of the events table (spec 002), counted in characters (RF-15).
export const MAX_TITLE = 100;
export const MAX_DESCRIPTION = 2000;
export const MAX_LOCATION = 200;

const knownZones = new Map<string, boolean>();

/** Whether `Intl` knows the zone: IANA names yes, Windows names such as "Romance Standard Time" no. */
function isKnownTimeZone(timeZone: string): boolean {
  let known = knownZones.get(timeZone);
  if (known === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      known = true;
    } catch {
      known = false;
    }
    knownZones.set(timeZone, known);
  }
  return known;
}

/** Drops the NUL character and lone UTF-16 surrogates, which Postgres rejects (plan D11). */
function clean(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      "",
    );
}

/** Cuts to `max` characters (code points, like Postgres), never inside an emoji. */
export function limit(text: string, max: number): string {
  const characters = Array.from(clean(text).trim());
  return characters.length > max
    ? characters.slice(0, max).join("").trim()
    : characters.join("");
}

/** The instant of a timed value, or null if its zone is not known (RF-21). */
export function instantOf(
  time: IcsTime,
  profileTimeZone: string,
): number | null {
  const wall = {
    year: time.year,
    month: time.month,
    day: time.day,
    hour: time.hour,
    minute: time.minute,
  };
  const seconds = time.second * 1000;
  switch (time.zone.kind) {
    case "utc":
      return (
        Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute) +
        seconds
      );
    case "floating":
      return zonedLocalToUtc(wall, profileTimeZone).getTime() + seconds;
    case "tzid":
      return isKnownTimeZone(time.zone.tzid)
        ? zonedLocalToUtc(wall, time.zone.tzid).getTime() + seconds
        : null;
  }
}

function dayStart(time: IcsTime): number {
  return Date.UTC(time.year, time.month - 1, time.day);
}

/** Start and end as instants, or null if the event cannot be placed. */
function rangeOf(
  occurrence: IcsOccurrence,
  profileTimeZone: string,
): { start: number; end: number } | null {
  const { start, end } = occurrence;

  if (start.allDay) {
    // An all-day end is already exclusive in iCalendar: the spec 002 convention (RF-17).
    const from = dayStart(start);
    if (!end) return { start: from, end: from + DAY_MS }; // RF-19
    const to = dayStart(end);
    if (to < from) return null; // RF-29
    return { start: from, end: to === from ? from + DAY_MS : to };
  }

  const from = instantOf(start, profileTimeZone);
  if (from === null) return null; // RF-21
  if (!end) return { start: from, end: from }; // RF-18
  const to = instantOf(end, profileTimeZone);
  if (to === null || to < from) return null; // RF-21, RF-29
  return { start: from, end: to };
}

const pad = (n: number) => String(n).padStart(2, "0");

const tzidOf = (time: IcsTime | null | undefined) =>
  time?.zone.kind === "tzid" ? time.zone.tzid : null;

/** The TZID of start and end (known by Intl, or the row was skipped). */
function zonesOf(occurrence: IcsOccurrence) {
  const start = occurrence.start.allDay ? null : tzidOf(occurrence.start);
  return {
    start_tz: start,
    end_tz: start && (tzidOf(occurrence.end) ?? start),
  };
}

/** 20261102T170000Z for a time, 20261208 for a date: like spec 018 ids. */
function stamp(time: IcsTime, profileTimeZone: string): string {
  const date = `${time.year}${pad(time.month)}${pad(time.day)}`;
  if (time.allDay) return date;
  const instant = instantOf(time, profileTimeZone);
  // A zone Intl does not know keeps its wall clock: still stable.
  if (instant === null) {
    return `${date}T${pad(time.hour)}${pad(time.minute)}${pad(time.second)}`;
  }
  return `${new Date(instant).toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/**
 * The identity of an occurrence in its .ics, stable between two reads
 * (spec 044 RF-2). Without a UID, its title and start stand in for it.
 */
export function externalIdOf(
  occurrence: IcsOccurrence,
  profileTimeZone: string,
): string {
  if (occurrence.recurrenceId) {
    return `${occurrence.uid || `sin-uid:${occurrence.summary}`}#${stamp(occurrence.recurrenceId, profileTimeZone)}`;
  }
  return (
    occurrence.uid ||
    `sin-uid:${occurrence.summary}#${stamp(occurrence.start, profileTimeZone)}`
  );
}

/**
 * Turns occurrences into event rows. Occurrences that cannot be converted
 * (unknown zone, end before start) are left out and counted in `skipped`.
 */
export function convertOccurrences(
  occurrences: IcsOccurrence[],
  profileTimeZone: string,
): { events: EventRow[]; skipped: number } {
  const events: EventRow[] = [];
  let skipped = 0;

  for (const occurrence of occurrences) {
    const range = rangeOf(occurrence, profileTimeZone);
    if (!range || Number.isNaN(range.start) || Number.isNaN(range.end)) {
      skipped++;
      continue;
    }
    events.push({
      title: limit(occurrence.summary, MAX_TITLE) || NO_TITLE,
      description: limit(occurrence.description, MAX_DESCRIPTION) || null,
      location: limit(occurrence.location, MAX_LOCATION) || null,
      starts_at: new Date(range.start).toISOString(),
      ends_at: new Date(range.end).toISOString(),
      all_day: occurrence.start.allDay,
      external_id: externalIdOf(occurrence, profileTimeZone),
      ...zonesOf(occurrence),
    });
  }

  return { events, skipped };
}
