// Google Calendar bodies from CaFam events (plan D6; RF-13 to RF-15). Only the
// fields CaFam shows; never color or category, which stay in CaFam (RF-16).

export interface WritableEvent {
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  /** Own zones (spec 045 RF-9); absent = as the event has them. */
  start_tz?: string | null;
  end_tz?: string | null;
}

type GoogleTime =
  | { date: string; dateTime?: null }
  | { dateTime: string; date?: null; timeZone?: string };

/**
 * All-day events are dates with an exclusive end, like CaFam (spec 002); timed
 * ones are UTC instants. `clear` empties the other field, which a PATCH keeps
 * otherwise when switching between the two (edge case of the spec).
 */
function times(event: WritableEvent, clear: boolean) {
  const time = (value: string, zone?: string | null): GoogleTime =>
    event.all_day
      ? { date: value.slice(0, 10), ...(clear && { dateTime: null }) }
      : {
          dateTime: new Date(value).toISOString(),
          // The event's own zone, so Google shows it like CaFam (spec 045 RF-9).
          ...(zone && { timeZone: zone }),
          ...(clear && { date: null }),
        };
  return {
    start: time(event.starts_at, event.start_tz),
    end: time(event.ends_at, event.end_tz ?? event.start_tz),
  };
}

export function toGoogleEvent(event: WritableEvent) {
  return {
    summary: event.title,
    description: event.description,
    location: event.location,
    ...times(event, false),
  };
}

/** Only what changed, so Google keeps guests, reminders and the rest (RF-14, RF-15). */
export function toGooglePatch(before: WritableEvent, changed: WritableEvent) {
  // A change without zones keeps the event's: Google would otherwise drop
  // them when the times go again (spec 045 RF-11).
  const after =
    changed.start_tz === undefined
      ? { ...changed, start_tz: before.start_tz, end_tz: before.end_tz }
      : changed;
  const patch: Record<string, unknown> = {};
  if (after.title !== before.title) patch.summary = after.title;
  if (after.description !== before.description)
    patch.description = after.description;
  if (after.location !== before.location) patch.location = after.location;
  if (
    after.all_day !== before.all_day ||
    Date.parse(after.starts_at) !== Date.parse(before.starts_at) ||
    Date.parse(after.ends_at) !== Date.parse(before.ends_at) ||
    (after.start_tz ?? null) !== (before.start_tz ?? null) ||
    (after.end_tz ?? after.start_tz ?? null) !==
      (before.end_tz ?? before.start_tz ?? null)
  ) {
    Object.assign(patch, times(after, true));
  }
  return patch;
}
