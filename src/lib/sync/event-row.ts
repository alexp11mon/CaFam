import { validZone } from "@/lib/calendar/event-zone";
import {
  limit,
  MAX_DESCRIPTION,
  MAX_LOCATION,
  MAX_TITLE,
  NO_TITLE,
  type EventRow,
} from "@/lib/ics/convert-events";

/** An event row of the .ics import plus the provider's id (spec 007, plan D7). */
export interface SyncedEventRow extends EventRow {
  external_id: string;
}

export interface ConvertResult {
  events: SyncedEventRow[];
  skipped: number;
}

const DAY_MS = 86_400_000;

/** start_tz and end_tz of a row: none for all-day events (spec 045 RF-7). */
export function ownZones(
  allDay: boolean,
  startTz: string | undefined,
  endTz: string | undefined,
): { start_tz: string | null; end_tz: string | null } {
  const start = allDay ? null : validZone(startTz ?? "");
  return {
    start_tz: start,
    end_tz: start && (validZone(endTz ?? "") ?? start),
  };
}

/** UTC midnight of a `YYYY-MM-DD…` value. */
export function dayStart(value: string): number {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}

/**
 * Builds a row with the texts cut to the table limits, or null when the range
 * cannot be placed (RF-17, RF-18). All-day ends are exclusive (spec 002).
 */
export function buildRow(fields: {
  id: string;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  start: number | null;
  end: number | null;
  allDay: boolean;
  /** Zones of the provider, kept when Intl knows them (spec 045 RF-9). */
  startTz?: string;
  endTz?: string;
}): SyncedEventRow | null {
  const { start, allDay } = fields;
  let end = fields.end;
  if (
    start === null ||
    end === null ||
    Number.isNaN(start) ||
    Number.isNaN(end)
  )
    return null;
  if (end < start) return null;
  if (allDay && end === start) end = start + DAY_MS;

  return {
    external_id: fields.id,
    title: limit(fields.title ?? "", MAX_TITLE) || NO_TITLE,
    description: limit(fields.description ?? "", MAX_DESCRIPTION) || null,
    location: limit(fields.location ?? "", MAX_LOCATION) || null,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
    all_day: allDay,
    ...ownZones(allDay, fields.startTz, fields.endTz),
  };
}
