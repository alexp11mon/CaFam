import { MAX_EVENTS } from "./limits";

interface Timed {
  starts_at: string;
  ends_at: string;
  external_id?: string;
}

/** How far an event is from `now`: zero while it is happening. */
function distance(event: Timed, now: number): number {
  const start = Date.parse(event.starts_at);
  const end = Date.parse(event.ends_at);
  if (start <= now && now <= end) return 0;
  return Math.min(Math.abs(start - now), Math.abs(end - now));
}

/**
 * Keeps the `max` events nearest to today, in their original order, and
 * counts the rest (RF-19, plan D17). `omittedIds` are the external ids left
 * out, so the reconciliation does not remove them (spec 038 RF-3).
 */
export function limitEvents<T extends Timed>(
  events: T[],
  now: Date,
  max = MAX_EVENTS,
): { events: T[]; omitted: number; omittedIds: string[] } {
  if (events.length <= max) return { events, omitted: 0, omittedIds: [] };

  const time = now.getTime();
  const kept = new Set(
    events
      .map((event, index) => ({ index, distance: distance(event, time) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, max)
      .map((item) => item.index),
  );
  return {
    events: events.filter((_, index) => kept.has(index)),
    omitted: events.length - max,
    omittedIds: events.flatMap((event, index) =>
      kept.has(index) || !event.external_id ? [] : [event.external_id],
    ),
  };
}
