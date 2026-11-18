// What the device keeps for offline use (spec 034 RF-1, RF-11). Pure: days
// are YYYY-MM-DD keys, both ends included.
import type { DayRange } from "@/lib/calendar/event-window";
import { formatDateKey, parseDateKey } from "@/lib/calendar/time-zone";

/** Months before and after today that the copy holds (RF-1). */
export const MONTHS_BEFORE = 1;
export const MONTHS_AFTER = 3;

/** The same day `months` later, on the last day when that month is shorter. */
export function addMonths(key: string, months: number): string {
  const parts = parseDateKey(key);
  if (!parts) throw new RangeError(`Invalid date key: ${key}`);
  const index = parts.year * 12 + parts.month - 1 + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return formatDateKey({ year, month, day: Math.min(parts.day, last) });
}

/** From a month before today to three months after, in the profile's zone. */
export function offlineRange(today: string): DayRange {
  return {
    from: addMonths(today, -MONTHS_BEFORE),
    to: addMonths(today, MONTHS_AFTER),
  };
}

/** Whether every day of `needed` is in the copy (RF-11). */
export function coversRange(range: DayRange, needed: DayRange): boolean {
  return needed.from >= range.from && needed.to <= range.to;
}
