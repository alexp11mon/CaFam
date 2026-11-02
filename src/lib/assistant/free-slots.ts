import {
  addDays,
  parseDateKey,
  utcDateKey,
  utcToZonedParts,
  zonedLocalToUtc,
} from "@/lib/calendar/time-zone";
import { dayBounds, minutesOf } from "./dates";
import { MIN_FREE_MINUTES, type TimeRange } from "./limits";

// Free time computed from the data, never by the model (spec 015 RF-19, D8).

/** A busy interval in UTC milliseconds, end exclusive. */
export interface BusyInterval {
  start: number;
  end: number;
}

export interface EventTimes {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

/**
 * RF-18: a timed event is busy during its hours; an all-day event fills its
 * days, read by UTC date (spec 002 D6) and laid on the asker's local days.
 */
export function busyFromEvent(
  event: EventTimes,
  timeZone: string,
): BusyInterval {
  if (!event.allDay) {
    return { start: Date.parse(event.startsAt), end: Date.parse(event.endsAt) };
  }
  const first = utcDateKey(event.startsAt);
  // The end is exclusive: midnight UTC of the day after the last one.
  const last = addDays(utcDateKey(event.endsAt), -1);
  return {
    start: dayBounds(first, timeZone).start.getTime(),
    end: dayBounds(last < first ? first : last, timeZone).end.getTime(),
  };
}

/** Wall-clock time of a local day, so DST days keep their hours. */
function localInstant(day: string, minutes: number, timeZone: string): number {
  if (minutes >= 1440) return dayBounds(day, timeZone).end.getTime();
  const parts = parseDateKey(day)!;
  return zonedLocalToUtc(
    { ...parts, hour: Math.floor(minutes / 60), minute: minutes % 60 },
    timeZone,
  ).getTime();
}

function label(instant: number, day: string, timeZone: string): string {
  if (instant >= dayBounds(day, timeZone).end.getTime()) return "24:00";
  const { hour, minute } = utcToZonedParts(instant, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Free gaps of everyone in each range of each day, in the asker's zone. */
export function freeSlots(
  busy: readonly BusyInterval[],
  days: readonly string[],
  ranges: readonly TimeRange[],
  timeZone: string,
  minMinutes: number = MIN_FREE_MINUTES,
): { date: string; free: TimeRange[] }[] {
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  return days.map((date) => {
    const free: TimeRange[] = [];
    for (const range of ranges) {
      const from = minutesOf(range.start);
      const to = minutesOf(range.end);
      if (from === null || to === null || to <= from) continue;
      let cursor = localInstant(date, from, timeZone);
      const end = localInstant(date, to, timeZone);
      const gaps: [number, number][] = [];
      for (const interval of sorted) {
        if (interval.end <= cursor || interval.start >= end) continue;
        if (interval.start > cursor) gaps.push([cursor, interval.start]);
        cursor = Math.max(cursor, interval.end);
        if (cursor >= end) break;
      }
      if (cursor < end) gaps.push([cursor, end]);
      for (const [start, stop] of gaps) {
        if (stop - start >= minMinutes * 60_000) {
          free.push({
            start: label(start, date, timeZone),
            end: label(stop, date, timeZone),
          });
        }
      }
    }
    return { date, free };
  });
}
