import { MONTHS_AHEAD, MONTHS_BACK } from "./limits";

/** The same day `months` later in UTC, clamped to the end of a shorter month. */
function addMonths(day: Date, months: number): Date {
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day.getUTCDate(), lastDay)));
}

/** Events window of a sync: today (UTC) minus 6 months to plus 12 months (RF-15). */
export function syncWindow(now: Date): { from: Date; to: Date } {
  return {
    from: addMonths(now, -MONTHS_BACK),
    to: addMonths(now, MONTHS_AHEAD),
  };
}

/**
 * Whether a synced event started before the window that is read today, so it
 * is an old copy that is no longer updated (spec 038 RF-6, plan D4).
 */
export function isOutsideWindow(startsAt: string, now: Date): boolean {
  return Date.parse(startsAt) < syncWindow(now).from.getTime();
}
