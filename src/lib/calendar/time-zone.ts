// Time zone and date-key helpers on top of Intl, no date library (plan D2).
// A "date key" is a plain calendar day as YYYY-MM-DD.

const DAY_MS = 86_400_000;

export interface DateKeyParts {
  year: number;
  month: number;
  day: number;
}

export interface ZonedParts extends DateKeyParts {
  hour: number;
  minute: number;
  second: number;
}

export interface LocalDateTime extends DateKeyParts {
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock parts of an instant in `timeZone` (RF-34). */
export function utcToZonedParts(
  instant: Date | number | string,
  timeZone: string,
): ZonedParts {
  const values: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    // Some engines print midnight as 24 even with h23.
    hour: (values.hour ?? 0) % 24,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function offsetMs(utcMs: number, timeZone: string): number {
  const whole = Math.floor(utcMs / 1000) * 1000;
  const parts = utcToZonedParts(whole, timeZone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - whole
  );
}

/**
 * The instant at which the wall clock of `timeZone` shows `local`.
 * An ambiguous autumn hour takes its first occurrence; a nonexistent spring
 * hour moves forward by the gap (02:30 -> 03:30), like Temporal's "compatible".
 */
export function zonedLocalToUtc(local: LocalDateTime, timeZone: string): Date {
  const guess = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  // Offsets a day before and after: a zone changes offset at most once in 48 h.
  const before = offsetMs(guess - DAY_MS, timeZone);
  const after = offsetMs(guess + DAY_MS, timeZone);
  const valid = [before, after]
    .filter((offset) => offsetMs(guess - offset, timeZone) === offset)
    .map((offset) => guess - offset);

  return new Date(valid.length > 0 ? Math.min(...valid) : guess - before);
}

export function parseDateKey(key: string): DateKeyParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return valid ? { year, month, day } : null;
}

export function formatDateKey({ year, month, day }: DateKeyParts): string {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function keyToUtcMs(key: string): number {
  const parts = parseDateKey(key);
  if (!parts) throw new RangeError(`Invalid date key: ${key}`);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function utcMsToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  return utcMsToKey(keyToUtcMs(key) + days * DAY_MS);
}

/** 0 = Monday ... 6 = Sunday (the week starts on Monday, spec RNF). */
export function weekdayIndex(key: string): number {
  return (new Date(keyToUtcMs(key)).getUTCDay() + 6) % 7;
}

/** Local calendar day of an instant in `timeZone`. */
export function zonedDateKey(
  instant: Date | number | string,
  timeZone: string,
): string {
  return formatDateKey(utcToZonedParts(instant, timeZone));
}

/** HH:mm in `timeZone` (RF-34). */
export function formatTime(
  instant: Date | number | string,
  timeZone: string,
): string {
  const { hour, minute } = utcToZonedParts(instant, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** UTC calendar day of an instant: how all-day events are read (plan D6). */
export function utcDateKey(instant: Date | number | string): string {
  return new Date(instant).toISOString().slice(0, 10);
}

/** All-day event: first day at 00:00 UTC, exclusive end the day after the last (RF-20). */
export function allDayToRange(
  startDate: string,
  endDate: string,
): { startsAt: string; endsAt: string } {
  return {
    startsAt: new Date(keyToUtcMs(startDate)).toISOString(),
    endsAt: new Date(keyToUtcMs(endDate) + DAY_MS).toISOString(),
  };
}

/** Inverse of allDayToRange: inclusive first and last day. */
export function allDayFromRange(
  startsAt: string,
  endsAt: string,
): { startDate: string; endDate: string } {
  const startDate = utcDateKey(startsAt);
  const lastDay = utcDateKey(Date.parse(endsAt) - DAY_MS);
  return { startDate, endDate: lastDay < startDate ? startDate : lastDay };
}
