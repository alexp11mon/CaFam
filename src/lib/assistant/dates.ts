import { todayKey } from "@/lib/calendar/format";
import { daysBetween, weekStart } from "@/lib/calendar/ranges";
import {
  addDays,
  parseDateKey,
  weekdayIndex,
  zonedLocalToUtc,
} from "@/lib/calendar/time-zone";

// Dates of the assistant, always in the profile's zone (spec 015 RF-7).

const WEEKDAYS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

export function weekdayName(dateKey: string): string {
  return WEEKDAYS[weekdayIndex(dateKey)] ?? "";
}

/** Start (inclusive) and end (exclusive) of a local day. */
export function dayBounds(dateKey: string, timeZone: string) {
  const at = (key: string) => {
    const parts = parseDateKey(key);
    if (!parts) throw new RangeError(`Invalid date key: ${key}`);
    return zonedLocalToUtc({ ...parts, hour: 0, minute: 0 }, timeZone);
  };
  return { start: at(dateKey), end: at(addDays(dateKey, 1)) };
}

/** RF-27: the quota restarts at 00:00 in the profile's zone. */
export function quotaDayStart(now: Date, timeZone: string): Date {
  return dayBounds(todayKey(timeZone, now), timeZone).start;
}

export type Period =
  | { status: "ok"; from: Date; to: Date; days: string[] }
  | { status: "invalid_date" }
  | { status: "too_long" };

/** A period of whole local days, both included, of at most `maxDays`. */
export function parsePeriod(
  from: string,
  to: string,
  timeZone: string,
  maxDays: number,
): Period {
  if (!parseDateKey(from) || !parseDateKey(to) || from > to) {
    return { status: "invalid_date" };
  }
  const count = daysBetween(from, to) + 1;
  if (count > maxDays) return { status: "too_long" };
  const days = Array.from({ length: count }, (_, i) => addDays(from, i));
  return {
    status: "ok",
    from: dayBounds(from, timeZone).start,
    to: dayBounds(to, timeZone).end,
    days,
  };
}

export interface DateContext {
  today: string;
  weekday: string;
  days: { date: string; weekday: string }[];
  thisWeek: { from: string; to: string };
  nextWeek: { from: string; to: string };
  weekend: { from: string; to: string };
}

/** What the prompt says about today so the model resolves relative dates (RF-7). */
export function dateContext(now: Date, timeZone: string): DateContext {
  const today = todayKey(timeZone, now);
  const monday = weekStart(today);
  return {
    today,
    weekday: weekdayName(today),
    days: Array.from({ length: 14 }, (_, i) => {
      const date = addDays(today, i);
      return { date, weekday: weekdayName(date) };
    }),
    thisWeek: { from: monday, to: addDays(monday, 6) },
    nextWeek: { from: addDays(monday, 7), to: addDays(monday, 13) },
    weekend: { from: addDays(monday, 5), to: addDays(monday, 6) },
  };
}

/** Minutes since midnight of "HH:MM" (24:00 allowed), or null. */
export function minutesOf(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[2]) < 60 && minutes <= 1440 ? minutes : null;
}
