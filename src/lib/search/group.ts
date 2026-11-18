import { utcDateKey, zonedDateKey } from "@/lib/calendar/time-zone";

export interface SearchTimes {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export interface SearchGroup<T> {
  /** YYYY-MM-DD in the profile zone, or the UTC date of an all-day event. */
  day: string;
  events: T[];
}

/** The day an event is listed under (plan 002 D6 for all-day events). */
function dayOf(event: SearchTimes, timeZone: string): string {
  return event.allDay
    ? utcDateKey(event.startsAt)
    : zonedDateKey(event.startsAt, timeZone);
}

function byDay<T extends SearchTimes>(
  events: T[],
  timeZone: string,
): SearchGroup<T>[] {
  const days = new Map<string, T[]>();
  for (const event of events) {
    const day = dayOf(event, timeZone);
    days.set(day, [...(days.get(day) ?? []), event]);
  }
  return [...days].map(([day, list]) => ({
    day,
    events: list.sort(
      (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
    ),
  }));
}

/**
 * Results by day: upcoming (not ended yet) ascending, then past ones newest
 * first (spec 039 RF-6).
 */
export function groupResults<T extends SearchTimes>(
  events: T[],
  timeZone: string,
  now: Date,
): { upcoming: SearchGroup<T>[]; past: SearchGroup<T>[] } {
  const time = now.getTime();
  const upcoming = events.filter((e) => Date.parse(e.endsAt) > time);
  const past = events.filter((e) => Date.parse(e.endsAt) <= time);
  return {
    upcoming: byDay(upcoming, timeZone).sort((a, b) =>
      a.day.localeCompare(b.day),
    ),
    past: byDay(past, timeZone).sort((a, b) => b.day.localeCompare(a.day)),
  };
}
