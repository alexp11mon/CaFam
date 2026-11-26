// Display and form helpers for events and views (spec 002 RF-20, RF-29, RF-34, RF-36).
import { AGENDA_DAYS, FOUR_DAYS, weekStart, type CalendarView } from "./ranges";
import {
  addDays,
  allDayFromRange,
  formatTime,
  utcToZonedParts,
  weekdayIndex,
  zonedDateKey,
} from "./time-zone";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { dateFormat } from "@/lib/i18n/format";

interface EventTimes {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

function formatDay(
  instant: Date | number | string,
  timeZone: string,
  locale: Locale,
): string {
  return dateFormat(locale, { dateStyle: "full", timeZone }).format(
    new Date(instant),
  );
}

/** Human-readable "when" of an event; all-day events are dates, never converted (plan D6). */
export function formatEventWhen(
  event: EventTimes,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (event.allDay) {
    const { startDate, endDate } = allDayFromRange(
      event.startsAt,
      event.endsAt,
    );
    const first = formatDay(`${startDate}T00:00:00Z`, "UTC", locale);
    return startDate === endDate
      ? first
      : `${first} – ${formatDay(`${endDate}T00:00:00Z`, "UTC", locale)}`;
  }

  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  const firstDay = formatDay(start, timeZone, locale);
  const startTime = formatTime(start, timeZone);
  if (end === start) return `${firstDay}, ${startTime}`;

  const endTime = formatTime(end, timeZone);
  if (zonedDateKey(start, timeZone) === zonedDateKey(end, timeZone)) {
    return `${firstDay}, ${startTime} – ${endTime}`;
  }
  return `${firstDay}, ${startTime} – ${formatDay(end, timeZone, locale)}, ${endTime}`;
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

const WEEKDAY_LABELS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** Short weekday of a date key, Monday first. */
export function weekdayLabel(
  dateKey: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (locale !== "es") return formatKey(dateKey, { weekday: "short" }, locale);
  return WEEKDAY_LABELS[weekdayIndex(dateKey)] ?? "";
}

function formatKey(
  dateKey: string,
  options: Intl.DateTimeFormatOptions,
  locale: Locale,
): string {
  return dateFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(`${dateKey}T00:00:00Z`),
  );
}

/** "miércoles, 21 de octubre" for a date key (spec 008 quick window). */
export function formatDayHeading(
  dateKey: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatKey(
    dateKey,
    { weekday: "long", day: "numeric", month: "long" },
    locale,
  );
}

/** "miércoles, 21 de octubre de 2026" for a date key. */
export function formatDateKeyFull(
  dateKey: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatKey(dateKey, { dateStyle: "full" }, locale);
}

/** Heading of the period shown by a view. */
export function formatPeriodTitle(
  view: CalendarView,
  dateKey: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (view === "day") return formatDateKeyFull(dateKey, locale);
  if (view === "month") {
    return formatKey(dateKey, { month: "long", year: "numeric" }, locale);
  }
  // The year is its number (spec 042 RF-4).
  if (view === "year") return dateKey.slice(0, 4);
  const first =
    view === "agenda" || view === "4days" ? dateKey : weekStart(dateKey);
  const length =
    view === "agenda" ? AGENDA_DAYS : view === "4days" ? FOUR_DAYS : 7;
  const last = addDays(first, length - 1);
  const short = { day: "numeric", month: "short" } as const;
  return `${formatKey(first, short, locale)} – ${formatKey(last, { ...short, year: "numeric" }, locale)}`;
}
