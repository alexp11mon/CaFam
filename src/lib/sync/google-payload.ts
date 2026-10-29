// Google Calendar bodies from CaFam events (plan D6; RF-13 to RF-15). Only the
// fields CaFam shows; never color or category, which stay in CaFam (RF-16).

export interface WritableEvent {
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
}

type GoogleTime =
  { date: string; dateTime?: null } | { dateTime: string; date?: null };

/**
 * All-day events are dates with an exclusive end, like CaFam (spec 002); timed
 * ones are UTC instants. `clear` empties the other field, which a PATCH keeps
 * otherwise when switching between the two (edge case of the spec).
 */
function times(event: WritableEvent, clear: boolean) {
  const time = (value: string): GoogleTime =>
    event.all_day
      ? { date: value.slice(0, 10), ...(clear && { dateTime: null }) }
      : {
          dateTime: new Date(value).toISOString(),
          ...(clear && { date: null }),
        };
  return { start: time(event.starts_at), end: time(event.ends_at) };
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
export function toGooglePatch(before: WritableEvent, after: WritableEvent) {
  const patch: Record<string, unknown> = {};
  if (after.title !== before.title) patch.summary = after.title;
  if (after.description !== before.description)
    patch.description = after.description;
  if (after.location !== before.location) patch.location = after.location;
  if (
    after.all_day !== before.all_day ||
    Date.parse(after.starts_at) !== Date.parse(before.starts_at) ||
    Date.parse(after.ends_at) !== Date.parse(before.ends_at)
  ) {
    Object.assign(patch, times(after, true));
  }
  return patch;
}
