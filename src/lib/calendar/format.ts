// Display and form helpers for events (spec 002 RF-20, RF-34, RF-36).
import {
  allDayFromRange,
  formatTime,
  utcToZonedParts,
  zonedDateKey,
} from "./time-zone";

interface EventTimes {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

function formatDay(instant: Date | number | string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeZone,
  }).format(new Date(instant));
}

/** Human-readable "when" of an event; all-day events are dates, never converted (plan D6). */
export function formatEventWhen(event: EventTimes, timeZone: string): string {
  if (event.allDay) {
    const { startDate, endDate } = allDayFromRange(
      event.startsAt,
      event.endsAt,
    );
    const first = formatDay(`${startDate}T00:00:00Z`, "UTC");
    return startDate === endDate
      ? first
      : `${first} – ${formatDay(`${endDate}T00:00:00Z`, "UTC")}`;
  }

  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  const firstDay = formatDay(start, timeZone);
  const startTime = formatTime(start, timeZone);
  if (end === start) return `${firstDay}, ${startTime}`;

  const endTime = formatTime(end, timeZone);
  if (zonedDateKey(start, timeZone) === zonedDateKey(end, timeZone)) {
    return `${firstDay}, ${startTime} – ${endTime}`;
  }
  return `${firstDay}, ${startTime} – ${formatDay(end, timeZone)}, ${endTime}`;
}

export interface EventFormDates {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export const DEFAULT_START_TIME = "09:00";
export const DEFAULT_END_TIME = "10:00";

/** Form dates of a stored event: local date and time, or inclusive UTC dates if all-day. */
export function eventToFormDates(
  event: EventTimes,
  timeZone: string,
): EventFormDates {
  if (event.allDay) {
    const { startDate, endDate } = allDayFromRange(
      event.startsAt,
      event.endsAt,
    );
    return {
      startDate,
      startTime: DEFAULT_START_TIME,
      endDate,
      endTime: DEFAULT_END_TIME,
    };
  }
  return {
    startDate: zonedDateKey(event.startsAt, timeZone),
    startTime: formatTime(event.startsAt, timeZone),
    endDate: zonedDateKey(event.endsAt, timeZone),
    endTime: formatTime(event.endsAt, timeZone),
  };
}

/** Today in the user's zone as YYYY-MM-DD. */
export function todayKey(timeZone: string, now: Date = new Date()): string {
  const { year, month, day } = utcToZonedParts(now, timeZone);
  return [year, month, day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}
