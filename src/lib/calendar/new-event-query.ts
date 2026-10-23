import { DEFAULT_END_TIME, DEFAULT_START_TIME } from "./format";
import { parseDateKey } from "./time-zone";

type Query = { [key: string]: string | string[] | undefined };

export interface NewEventDefaults {
  calendarId: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  title: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const LAST_MINUTE = 23 * 60 + 59;

function single(query: Query, key: string): string | undefined {
  const value = query[key];
  return typeof value === "string" ? value : undefined;
}

const toMinutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Starting values of a new event from its URL: what the quick window or a
 * day/slot link passes on (spec 008 RF-39). Anything invalid falls back to the
 * defaults, as `date` and `calendar` always did.
 */
export function parseNewEventQuery(
  query: Query,
  editableCalendarIds: string[],
  today: string,
): NewEventDefaults {
  const calendar = single(query, "calendar");
  const date = single(query, "date");
  const start = single(query, "start");
  const end = single(query, "end");
  const title = single(query, "title") ?? "";

  const startTime = start && TIME.test(start) ? start : DEFAULT_START_TIME;
  // The end follows the start one hour later unless a later one is given,
  // never past the day (spec 008 RF-30).
  const endTime =
    end && TIME.test(end) && toMinutes(end) > toMinutes(startTime)
      ? end
      : start && TIME.test(start)
        ? fromMinutes(Math.min(toMinutes(startTime) + 60, LAST_MINUTE))
        : DEFAULT_END_TIME;

  return {
    calendarId:
      calendar && editableCalendarIds.includes(calendar)
        ? calendar
        : editableCalendarIds[0]!,
    date: date && parseDateKey(date) ? date : today,
    startTime,
    endTime,
    allDay: single(query, "allDay") === "1",
    title: title.length <= 100 ? title : "",
  };
}
