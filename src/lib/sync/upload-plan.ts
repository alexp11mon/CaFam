import { limitEvents } from "./limit-events";
import { syncWindow } from "./window";

interface Timed {
  starts_at: string;
  ends_at: string;
}

/** The two numbers shown before uploading, as of now (RF-43). */
export function uploadCounts(events: Timed[]) {
  const { toGoogle, onlyCafam } = planUpload(events, new Date());
  return { toGoogle: toGoogle.length, onlyCafam };
}

/**
 * Which events of an uploaded calendar go to Google: those of the sync window,
 * up to 2,000; the rest stay only in CaFam (RF-35, RF-42, RF-43).
 */
export function planUpload<T extends Timed>(
  events: T[],
  now: Date,
): { toGoogle: T[]; onlyCafam: number } {
  const { from, to } = syncWindow(now);
  const inside = events.filter(
    (event) =>
      Date.parse(event.ends_at) >= from.getTime() &&
      Date.parse(event.starts_at) <= to.getTime(),
  );
  const { events: toGoogle } = limitEvents(inside, now);
  return { toGoogle, onlyCafam: events.length - toGoogle.length };
}
