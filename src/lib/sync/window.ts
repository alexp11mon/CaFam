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
