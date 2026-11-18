// The window of events the browser keeps so that changing period needs no
// request (spec 024 RF-1..RF-6, plan D1, D3, D4). Pure: days are YYYY-MM-DD
// keys, both ends included.
import {
  AGENDA_AFTER,
  AGENDA_BEFORE,
  daysBetween,
  navigate,
  visibleDayKeys,
  type CalendarView,
} from "./ranges";
import { addDays } from "./time-zone";

export interface DayRange {
  from: string;
  to: string;
}

/** The most days one call of the loading action reads. */
export const WINDOW_MAX_DAYS = 124;
/** The most days the browser keeps (RF-6). */
export const WINDOW_KEEP_DAYS = 400;

const DAY_MS = 86_400_000;

const min = (a: string, b: string) => (a < b ? a : b);
const max = (a: string, b: string) => (a > b ? a : b);

/** First and last day a view shows for a date. */
export function visibleDayRange(view: CalendarView, date: string): DayRange {
  const days = visibleDayKeys(view, date);
  return { from: days[0]!, to: days.at(-1)! };
}

/** The days whose events a view needs: the year reads only marks (spec 042 RF-5). */
export function eventDays(view: CalendarView, date: string): DayRange {
  return view === "year"
    ? { from: date, to: date }
    : visibleDayRange(view, date);
}

/**
 * What the server reads for a date, whatever the view: the weeks of the
 * previous month to those of the next one, and at least the agenda's days
 * (RF-1, plan D3).
 */
export function serverWindow(date: string): DayRange {
  return {
    from: min(
      visibleDayRange("month", navigate("month", date, -1)).from,
      addDays(date, -AGENDA_BEFORE),
    ),
    to: max(
      visibleDayRange("month", navigate("month", date, 1)).to,
      addDays(date, AGENDA_AFTER - 1),
    ),
  };
}

/** The visible period and one more on each side: what idle time loads (RF-3). */
export function warmRange(view: CalendarView, date: string): DayRange {
  const visible = eventDays(view, date);
  if (view === "agenda" || view === "year") return visible;
  if (view === "day") {
    return { from: addDays(date, -7), to: addDays(date, 7) };
  }
  return {
    from: visibleDayRange(view, navigate(view, date, -1)).from,
    to: visibleDayRange(view, navigate(view, date, 1)).to,
  };
}

export type LoadPlan = {
  /** `extend` adds to the window; `replace` starts a new one (plan D4). */
  mode: "extend" | "replace";
  ranges: DayRange[];
} | null;

function clamp(range: DayRange): DayRange {
  return daysBetween(range.from, range.to) + 1 > WINDOW_MAX_DAYS
    ? { from: range.from, to: addDays(range.from, WINDOW_MAX_DAYS - 1) }
    : range;
}

/** What to read so that `needed` is in the window; null when it already is. */
export function planLoad(loaded: DayRange, needed: DayRange): LoadPlan {
  if (needed.from >= loaded.from && needed.to <= loaded.to) return null;
  const touches =
    needed.from <= addDays(loaded.to, 1) &&
    needed.to >= addDays(loaded.from, -1);
  if (!touches) return { mode: "replace", ranges: [clamp(needed)] };
  const ranges: DayRange[] = [];
  if (needed.from < loaded.from) {
    ranges.push({ from: needed.from, to: addDays(loaded.from, -1) });
  }
  if (needed.to > loaded.to) {
    ranges.push({ from: addDays(loaded.to, 1), to: needed.to });
  }
  if (ranges.some((range) => clamp(range) !== range)) {
    return { mode: "replace", ranges: [clamp(needed)] };
  }
  return { mode: "extend", ranges };
}

export interface EventWindow<T> {
  range: DayRange;
  events: T[];
}

/** The window with what was just read; an event read twice keeps its newest copy. */
export function mergeWindow<T extends { id: string }>(
  window: EventWindow<T>,
  fetched: EventWindow<T>,
  mode: "extend" | "replace",
): EventWindow<T> {
  if (mode === "replace") return fetched;
  const byId = new Map(window.events.map((event) => [event.id, event]));
  for (const event of fetched.events) {
    // An event read again and unchanged keeps the object the views already
    // have, so they are not painted again (RNF-5).
    const known = byId.get(event.id);
    if (!known || JSON.stringify(known) !== JSON.stringify(event)) {
      byId.set(event.id, event);
    }
  }
  return {
    range: {
      from: min(window.range.from, fetched.range.from),
      to: max(window.range.to, fetched.range.to),
    },
    events: [...byId.values()],
  };
}

/** Drops the days furthest from `around` once the window is too long (RF-6). */
export function trimWindow<T extends { startsAt: string; endsAt: string }>(
  window: EventWindow<T>,
  around: DayRange,
): EventWindow<T> {
  if (daysBetween(window.range.from, window.range.to) + 1 <= WINDOW_KEEP_DAYS) {
    return window;
  }
  const spare = Math.max(
    0,
    Math.floor(
      (WINDOW_KEEP_DAYS - (daysBetween(around.from, around.to) + 1)) / 2,
    ),
  );
  const range = {
    from: max(window.range.from, addDays(around.from, -spare)),
    to: min(window.range.to, addDays(around.to, spare)),
  };
  // A day of slack on each side: zones and all-day dates (plan D6 of 002).
  const from = Date.parse(`${range.from}T00:00:00Z`) - DAY_MS;
  const to = Date.parse(`${range.to}T00:00:00Z`) + 2 * DAY_MS;
  return {
    range,
    events: window.events.filter(
      (event) =>
        Date.parse(event.startsAt) < to && Date.parse(event.endsAt) >= from,
    ),
  };
}

/** Events that overlap [from, to): the same test as `getEventsInRange`. */
export function eventsInRange<T extends { startsAt: string; endsAt: string }>(
  events: readonly T[],
  from: Date,
  to: Date,
): T[] {
  const start = from.getTime();
  const end = to.getTime();
  return events.filter(
    (event) =>
      Date.parse(event.startsAt) < end && Date.parse(event.endsAt) >= start,
  );
}
