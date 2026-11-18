import type { SyncedEventRow } from "./event-row";
import { convertGoogleEvents, type GoogleEvent } from "./google-events";
import type { WritableEvent } from "./google-payload";
import { expandObject, splitExternalId } from "./icloud-ics";

// Server only: one event as the provider has it now, in the fields CaFam
// writes (spec 035 RF-5, RF-6, plan D1). A change made offline is compared
// with it before writing, as the 034 compares with Postgres.

const DAY_MS = 86_400_000;

function writable(row: SyncedEventRow): WritableEvent {
  return {
    title: row.title,
    description: row.description,
    location: row.location,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    all_day: row.all_day,
  };
}

/** A Google event, or null when it was cancelled (a deleted repetition). */
export function googleWritable(event: GoogleEvent): WritableEvent | null {
  const row = convertGoogleEvents([event]).events[0];
  return row ? writable(row) : null;
}

/** `20261123T170000Z` or `20261123` as an instant. */
function keyInstant(key: string): number {
  const iso = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/.exec(key);
  if (!iso) return Number.NaN;
  const [, y, m, d, hh = "00", mm = "00", ss = "00"] = iso;
  return Date.parse(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
}

/**
 * The event `externalId` names inside an iCloud resource: the resource
 * itself, its own VEVENT for a repetition, or the repetition the series
 * gives (plan R3). Null when it is not there (deleted or cancelled).
 */
export function icloudWritable(
  externalId: string,
  ics: string,
): WritableEvent | null {
  const { href, recurrenceId } = splitExternalId(externalId);
  const at = recurrenceId ? keyInstant(recurrenceId) : Number.NaN;
  // A moved repetition can start far from its key: a year either side.
  const window = Number.isNaN(at)
    ? { from: new Date(0), to: new Date(Date.UTC(9999, 0, 1)) }
    : { from: new Date(at - 366 * DAY_MS), to: new Date(at + 366 * DAY_MS) };
  const row = expandObject(href, ics, window).events.find(
    (event) => event.external_id === externalId,
  );
  return row ? writable(row) : null;
}
