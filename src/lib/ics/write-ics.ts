import { utcToZonedParts, zonedLocalToUtc } from "@/lib/calendar/time-zone";
import { escapeText, foldLine } from "./fold";
import { vtimezone } from "./vtimezone";

// Writes events as an .ics (spec 043 RF-3..RF-6, plan D1). Pure: no ical.js,
// so it runs anywhere; the tests read it back with parse-ics.

/** A row of `events` with what the file needs. */
export interface IcsRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  recurrence: string | null;
  recurrence_tz: string | null;
  exdates: string[] | null;
  series_id: string | null;
  original_start: string | null;
  created_at: string;
  updated_at: string;
  /** Calendar name, written as CATEGORIES when several are mixed (RF-2). */
  category?: string;
  /** Own zones of a single event (spec 045 RF-10). */
  start_tz?: string | null;
  end_tz?: string | null;
}

/** The zones a row is written in: a series' own, or a single event's. */
function zonesOfRow(row: IcsRow): { start: string | null; end: string | null } {
  if (row.all_day) return { start: null, end: null };
  if (row.recurrence)
    return { start: row.recurrence_tz, end: row.recurrence_tz };
  if (row.series_id) return { start: null, end: null };
  const start = row.start_tz ?? null;
  return { start, end: start && (row.end_tz ?? start) };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 20261120T170000Z */
function utcStamp(instant: string | Date): string {
  return (
    new Date(instant).toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z"
  );
}

/** 20261120, the UTC date (all-day convention, spec 002 D6). */
function dateStamp(instant: string): string {
  return new Date(instant).toISOString().slice(0, 10).replace(/-/g, "");
}

/** 20261120T180000, the wall clock in `timeZone`. */
function localStamp(instant: string, timeZone: string): string {
  const p = utcToZonedParts(instant, timeZone);
  return `${p.year}${pad(p.month)}${pad(p.day)}T${pad(p.hour)}${pad(p.minute)}${pad(p.second)}`;
}

/** `NAME;VALUE=DATE:…`, `NAME;TZID=…:…` or `NAME:…Z`. */
function timeProperty(
  name: string,
  instant: string,
  allDay: boolean,
  timeZone: string | null,
): string {
  if (allDay) return `${name};VALUE=DATE:${dateStamp(instant)}`;
  if (timeZone)
    return `${name};TZID=${timeZone}:${localStamp(instant, timeZone)}`;
  return `${name}:${utcStamp(instant)}`;
}

/**
 * The app writes a timed UNTIL as the end of a day in wall-clock time; with a
 * zoned DTSTART, RFC 5545 wants it in UTC.
 */
function rrule(rule: string, timeZone: string | null): string {
  if (!timeZone) return rule;
  return rule.replace(
    /UNTIL=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?!Z)/,
    (_, y, mo, d, h, mi, s) =>
      `UNTIL=${utcStamp(
        new Date(
          zonedLocalToUtc(
            { year: +y, month: +mo, day: +d, hour: +h, minute: +mi },
            timeZone,
          ).getTime() +
            +s * 1000,
        ),
      )}`,
  );
}

export function writeIcs({
  name,
  rows,
  now,
}: {
  name: string;
  rows: readonly IcsRow[];
  now: Date;
}): string {
  const series = new Map(
    rows.filter((row) => row.recurrence).map((row) => [row.id, row]),
  );
  const zones = new Set<string>();
  for (const row of rows) {
    const { start, end } = zonesOfRow(row);
    if (start) zones.add(start);
    if (end) zones.add(end);
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CaFam//CaFam//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const zone of zones)
    lines.push(...vtimezone(zone, now.getUTCFullYear()));

  const stamp = utcStamp(now);
  for (const row of rows) {
    const master = row.series_id ? series.get(row.series_id) : undefined;
    const own = zonesOfRow(row);
    const zone = row.recurrence ? own.start : null;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${row.series_id ?? row.id}@cafam`,
      `DTSTAMP:${stamp}`,
    );
    if (row.series_id && row.original_start) {
      // The key of the occurrence, written like the DTSTART of its series so
      // clients relate it (spec 018 trap).
      lines.push(
        master
          ? timeProperty(
              "RECURRENCE-ID",
              row.original_start,
              master.all_day,
              master.all_day ? null : master.recurrence_tz,
            )
          : `RECURRENCE-ID:${utcStamp(row.original_start)}`,
      );
    }
    lines.push(
      timeProperty("DTSTART", row.starts_at, row.all_day, own.start),
      timeProperty("DTEND", row.ends_at, row.all_day, own.end),
    );
    if (row.recurrence) {
      lines.push(`RRULE:${rrule(row.recurrence, zone)}`);
      for (const exdate of row.exdates ?? []) {
        lines.push(timeProperty("EXDATE", exdate, row.all_day, zone));
      }
    }
    lines.push(`SUMMARY:${escapeText(row.title)}`);
    if (row.description)
      lines.push(`DESCRIPTION:${escapeText(row.description)}`);
    if (row.location) lines.push(`LOCATION:${escapeText(row.location)}`);
    if (row.category) lines.push(`CATEGORIES:${escapeText(row.category)}`);
    lines.push(
      `CREATED:${utcStamp(row.created_at)}`,
      `LAST-MODIFIED:${utcStamp(row.updated_at)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
