// Visible ranges, navigation and URL parameters of the calendar views
// (spec 002 RF-29, RF-30, plan D12; agenda from spec 005 RF-31, RF-40, plan D6).
import {
  addDays,
  formatDateKey,
  parseDateKey,
  weekdayIndex,
  zonedLocalToUtc,
} from "./time-zone";

export type CalendarView = "agenda" | "month" | "week" | "day";

export const VIEWS: readonly CalendarView[] = [
  "agenda",
  "month",
  "week",
  "day",
];

export function isCalendarView(value: unknown): value is CalendarView {
  return VIEWS.some((view) => view === value);
}

/** Days in a row shown by the agenda (spec 005 RF-31). */
export const AGENDA_DAYS = 14;

export interface VisibleRange {
  view: CalendarView;
  /** Every day shown, as YYYY-MM-DD, Monday first. */
  days: string[];
  /** Instants [from, to) to query: wide enough for local days and UTC all-day dates. */
  from: Date;
  to: Date;
}

export function weekStart(dateKey: string): string {
  return addDays(dateKey, -weekdayIndex(dateKey));
}

function firstOfMonth(dateKey: string): string {
  const parts = parseDateKey(dateKey);
  if (!parts) throw new RangeError(`Invalid date key: ${dateKey}`);
  return formatDateKey({ ...parts, day: 1 });
}

function lastOfMonth(dateKey: string): string {
  const first = firstOfMonth(dateKey);
  const parts = parseDateKey(first)!;
  const nextMonth = formatDateKey(
    parts.month === 12
      ? { year: parts.year + 1, month: 1, day: 1 }
      : { ...parts, month: parts.month + 1 },
  );
  return addDays(nextMonth, -1);
}

function listDays(first: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(first, index));
}

function startOfDay(dateKey: string, timeZone: string): Date {
  const { year, month, day } = parseDateKey(dateKey)!;
  return zonedLocalToUtc({ year, month, day, hour: 0, minute: 0 }, timeZone);
}

export function getVisibleRange(
  view: CalendarView,
  dateKey: string,
  timeZone: string,
): VisibleRange {
  let first: string;
  let count: number;
  if (view === "month") {
    first = weekStart(firstOfMonth(dateKey));
    const last = addDays(weekStart(lastOfMonth(dateKey)), 6);
    count = daysBetween(first, last) + 1;
  } else if (view === "week") {
    first = weekStart(dateKey);
    count = 7;
  } else if (view === "agenda") {
    first = dateKey;
    count = AGENDA_DAYS;
  } else {
    first = dateKey;
    count = 1;
  }

  const days = listDays(first, count);
  const end = addDays(first, count);
  // All-day events sit at 00:00 UTC of their date, which can fall outside the
  // local window of the first or last day (plan D6).
  const utcFrom = new Date(`${first}T00:00:00Z`);
  const utcTo = new Date(`${end}T00:00:00Z`);
  const localFrom = startOfDay(first, timeZone);
  const localTo = startOfDay(end, timeZone);

  return {
    view,
    days,
    from: new Date(Math.min(utcFrom.getTime(), localFrom.getTime())),
    to: new Date(Math.max(utcTo.getTime(), localTo.getTime())),
  };
}

function daysBetween(first: string, last: string): number {
  return Math.round(
    (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) /
      86_400_000,
  );
}

/** Reference date of the previous (-1) or next (+1) period. */
export function navigate(
  view: CalendarView,
  dateKey: string,
  direction: -1 | 1,
): string {
  if (view === "day") return addDays(dateKey, direction);
  if (view === "agenda") return addDays(dateKey, AGENDA_DAYS * direction);
  if (view === "week") return addDays(dateKey, 7 * direction);
  const parts = parseDateKey(dateKey)!;
  const month = parts.month + direction;
  return formatDateKey({
    year: parts.year + (month < 1 ? -1 : month > 12 ? 1 : 0),
    month: month < 1 ? 12 : month > 12 ? 1 : month,
    day: 1,
  });
}

type SearchParam = string | string[] | undefined;

/**
 * Reads `?view=&date=`; anything invalid falls back to the agenda of `todayKey`
 * (spec 005 RF-15, RF-44). Without a view in the URL the saved one opens
 * (spec 008 RF-26); a view in the URL always wins (RF-27).
 */
export function parseViewParams(
  params: { view?: SearchParam; date?: SearchParam },
  todayKey: string,
  savedView?: string | null,
): { view: CalendarView; date: string } {
  const view =
    params.view === undefined && isCalendarView(savedView)
      ? savedView
      : VIEWS.find((candidate) => candidate === params.view);
  const date =
    typeof params.date === "string" && parseDateKey(params.date)
      ? params.date
      : todayKey;
  return { view: view ?? "agenda", date };
}

export function calendarHref(view: CalendarView, dateKey: string): string {
  return `/dashboard/calendar?view=${view}&date=${dateKey}`;
}
