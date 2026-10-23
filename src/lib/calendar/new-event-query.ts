import { DEFAULT_END_TIME, DEFAULT_START_TIME } from "./format";
import { clampEnd, fromMinutes, toMinutes } from "./time-options";
import { parseDateKey } from "./time-zone";

type Query = { [key: string]: string | string[] | undefined };

export interface NewEventDefaults {
  calendarId: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  title: string;
  /** Event to copy from (spec 008 RF-35); read later with RLS. */
  from?: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function single(query: Query, key: string): string | undefined {
  const value = query[key];
  return typeof value === "string" ? value : undefined;
}

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
  const from = single(query, "from");

  const startTime = start && TIME.test(start) ? start : DEFAULT_START_TIME;
  // The end follows the start one hour later unless a later one is given,
  // never past the day (spec 008 RF-30).
  const endTime =
    end && TIME.test(end) && toMinutes(end) > toMinutes(startTime)
      ? end
      : start && TIME.test(start)
        ? fromMinutes(clampEnd(toMinutes(startTime) + 60))
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
    from: from && UUID.test(from) ? from : undefined,
  };
}
