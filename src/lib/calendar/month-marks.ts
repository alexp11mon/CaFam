// Dots under the days of the mini month: which calendars have events on each
// day (spec 005 RF-24; plan mini-month, D10).
import { eventDayKeys, type LayoutEventInput } from "./layout";

export type MonthMarks = Record<string, string[]>;

const MAX_DOTS = 3;

/** Calendar ids with events on each of `days`, once each, in order of appearance. */
export function monthMarks(
  events: readonly (LayoutEventInput & { calendarId: string })[],
  days: readonly string[],
  timeZone: string,
): MonthMarks {
  const inMonth = new Set(days);
  const marks: MonthMarks = {};
  for (const event of events) {
    for (const day of eventDayKeys(event, timeZone)) {
      if (!inMonth.has(day)) continue;
      const ids = (marks[day] ??= []);
      if (!ids.includes(event.calendarId)) ids.push(event.calendarId);
    }
  }
  return marks;
}

/** At most three visible calendars per day; days left without any are dropped. */
export function visibleMarks(
  marks: MonthMarks,
  visibleCalendarIds: ReadonlySet<string>,
): MonthMarks {
  const result: MonthMarks = {};
  for (const [day, ids] of Object.entries(marks)) {
    const shown = ids.filter((id) => visibleCalendarIds.has(id));
    if (shown.length > 0) result[day] = shown.slice(0, MAX_DOTS);
  }
  return result;
}
