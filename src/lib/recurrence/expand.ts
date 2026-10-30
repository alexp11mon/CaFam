import ICAL from "ical.js";
import {
  addDays,
  formatDateKey,
  utcToZonedParts,
  zonedLocalToUtc,
} from "@/lib/calendar/time-zone";
import {
  fromRRule,
  toRRule,
  type RecurrenceEnd,
  type RecurrenceRule,
} from "./rule";
import { WEEKDAYS } from "./schemas";

// Expands series into occurrences (plan D2, D3). Server only: the second and
// last module that imports ical.js (constitution, enmienda 3; plan R7).
//
// ical.js iterates in wall-clock ("floating") time and each occurrence is
// turned into an instant with the zone of the series, so 18:00 stays 18:00
// across daylight saving changes (RF-12). All-day series use UTC dates without
// any zone (RF-14).

const DAY_MS = 86_400_000;
/** A broken rule can never hang a page. */
const MAX_STEPS = 20_000;

export interface SeriesInput {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  recurrence: string;
  recurrenceTz: string | null;
}

export interface Occurrence {
  /** Start the rule gives it: its key for exceptions and exdates. */
  originalStart: string;
  startsAt: string;
  endsAt: string;
}

interface Local {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

interface Prepared {
  rule: RecurrenceRule;
  recur: ICAL.Recur;
  start: Local;
  /** Wall-clock length of each occurrence. */
  durationMs: number;
  allDay: boolean;
  timeZone: string | null;
  /** Last zone offset used, reused while it holds (toInstant). */
  offset?: number;
}

function floatingMs(local: Local): number {
  return Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
}

function fromFloating(ms: number): Local {
  const date = new Date(ms);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

function toLocal(instant: string, series: SeriesInput): Local {
  if (series.allDay || !series.recurrenceTz) {
    return fromFloating(Math.floor(Date.parse(instant) / DAY_MS) * DAY_MS);
  }
  const { year, month, day, hour, minute } = utcToZonedParts(
    instant,
    series.recurrenceTz,
  );
  return { year, month, day, hour, minute };
}

function prepare(
  series: SeriesInput,
  options: { withoutCount?: boolean } = {},
): Prepared | null {
  let rule = fromRRule(series.recurrence);
  if (!rule || (!series.allDay && !series.recurrenceTz)) return null;
  if (options.withoutCount && rule.end.kind === "count") {
    rule = { ...rule, end: { kind: "never" } };
  }
  const start = toLocal(series.startsAt, series);
  const end = toLocal(series.endsAt, series);
  try {
    return {
      rule,
      recur: ICAL.Recur.fromString(toRRule(rule, series.allDay)),
      start,
      durationMs: Math.max(0, floatingMs(end) - floatingMs(start)),
      allDay: series.allDay,
      timeZone: series.recurrenceTz,
    };
  } catch {
    return null;
  }
}

function toInstant(local: Local, prepared: Prepared): number {
  if (prepared.allDay || !prepared.timeZone) return floatingMs(local);
  const guess = floatingMs(local);
  // The offset changes twice a year: try the previous one with a single Intl
  // call before the full conversion (four calls). Going forward in time, an
  // ambiguous autumn hour still gets its first instant, like zonedLocalToUtc.
  if (prepared.offset !== undefined) {
    const candidate = guess - prepared.offset;
    const parts = utcToZonedParts(candidate, prepared.timeZone);
    if (floatingMs(parts) === guess && parts.second === 0) return candidate;
  }
  const instant = zonedLocalToUtc(local, prepared.timeZone).getTime();
  prepared.offset = guess - instant;
  return instant;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * RFC 5545 counts DTSTART as an occurrence even when it does not follow the
 * rule; CaFam does not ("cada lunes" from a Wednesday, plan D5).
 */
function matches(rule: RecurrenceRule, local: Local): boolean {
  const weekday = WEEKDAYS[(new Date(floatingMs(local)).getUTCDay() + 6) % 7]!;
  switch (rule.freq) {
    case "daily":
      return true;
    case "weekly":
      return rule.byDay.includes(weekday);
    case "monthly": {
      const { monthly } = rule;
      if ("day" in monthly) return local.day === monthly.day;
      if (monthly.weekday !== weekday) return false;
      return monthly.pos === -1
        ? local.day + 7 > daysInMonth(local.year, local.month)
        : Math.ceil(local.day / 7) === monthly.pos;
    }
    case "yearly":
      return local.month === rule.yearly.month && local.day === rule.yearly.day;
  }
}

/** Wall-clock starts that follow the rule, in order. */
function* walk(prepared: Prepared, fastForwardTo?: number): Generator<Local> {
  const { rule } = prepared;
  let start = prepared.start;
  // Daily and weekly patterns repeat every INTERVAL days or weeks, so a series
  // that started years ago can start right before the range (plan D6). COUNT
  // needs the occurrences before, so it never jumps.
  if (
    fastForwardTo !== undefined &&
    rule.end.kind !== "count" &&
    (rule.freq === "daily" || rule.freq === "weekly")
  ) {
    const period = rule.interval * (rule.freq === "weekly" ? 7 : 1) * DAY_MS;
    // Room for the length of an occurrence and any zone offset.
    const margin = prepared.durationMs + 2 * DAY_MS;
    const jumps = Math.floor(
      (fastForwardTo - margin - floatingMs(start)) / period,
    );
    if (jumps > 0) start = fromFloating(floatingMs(start) + jumps * period);
  }

  const iterator = prepared.recur.iterator(
    ICAL.Time.fromData({ ...start, second: 0, isDate: prepared.allDay }),
  );
  let steps = 0;
  for (let next = iterator.next(); next; next = iterator.next()) {
    if (++steps > MAX_STEPS) return;
    const local = {
      year: next.year,
      month: next.month,
      day: next.day,
      hour: next.hour,
      minute: next.minute,
    };
    if (matches(rule, local)) yield local;
  }
}

function occurrenceOf(local: Local, prepared: Prepared): Occurrence {
  const start = toInstant(local, prepared);
  const end = toInstant(
    fromFloating(floatingMs(local) + prepared.durationMs),
    prepared,
  );
  const startsAt = new Date(start).toISOString();
  return {
    originalStart: startsAt,
    startsAt,
    endsAt: new Date(end).toISOString(),
  };
}

/**
 * Occurrences that overlap [from, to), like getEventsInRange (starts before
 * `to`, ends at or after `from`), without those in `skip` (original starts
 * with an exception or in exdates). An unreadable rule gives none (plan R3).
 */
export function expandSeries(
  series: SeriesInput,
  from: Date,
  to: Date,
  skip: Set<number> = new Set(),
  options: { fastForward?: boolean } = {},
): Occurrence[] {
  const prepared = prepare(series);
  if (!prepared) return [];
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const result: Occurrence[] = [];
  const fastForward = options.fastForward ?? true;
  for (const local of walk(prepared, fastForward ? fromMs : undefined)) {
    const occurrence = occurrenceOf(local, prepared);
    const start = Date.parse(occurrence.startsAt);
    if (start >= toMs) break;
    if (Date.parse(occurrence.endsAt) < fromMs || skip.has(start)) continue;
    result.push(occurrence);
  }
  return result;
}

/**
 * The first occurrence, where a new series really starts (plan D5); null when
 * the rule gives none (RF-8). COUNT counts from that occurrence.
 */
export function firstOccurrence(series: SeriesInput): Occurrence | null {
  const prepared = prepare(series, { withoutCount: true });
  if (!prepared) return null;
  const first = walk(prepared).next();
  return first.done ? null : occurrenceOf(first.value, prepared);
}

/** End of the last occurrence, for recurrence_until; null without end. */
export function seriesBound(series: SeriesInput): string | null {
  const prepared = prepare(series);
  if (!prepared || prepared.rule.end.kind === "never") return null;
  let last: Occurrence | null = null;
  let steps = 0;
  for (const local of walk(prepared)) {
    // Too many to count: treat it as endless, which only widens reads.
    if (++steps >= MAX_STEPS) return null;
    last = occurrenceOf(local, prepared);
  }
  return last?.endsAt ?? null;
}

/**
 * "Este y los siguientes" (RF-17): the series' rule ending right before
 * `originalStart` and the end left for the new series. A null recurrence means
 * no occurrence comes before.
 */
export function truncateBefore(
  series: SeriesInput,
  originalStart: string,
): {
  recurrence: string | null;
  until: string | null;
  remaining: RecurrenceEnd;
} {
  const prepared = prepare(series);
  if (!prepared)
    return { recurrence: null, until: null, remaining: { kind: "never" } };
  const { rule } = prepared;
  const split = Date.parse(originalStart);
  let before = 0;
  let lastEnd: string | null = null;
  for (const local of walk(prepared, undefined)) {
    const occurrence = occurrenceOf(local, prepared);
    if (Date.parse(occurrence.startsAt) >= split) break;
    before++;
    lastEnd = occurrence.endsAt;
  }
  if (before === 0)
    return { recurrence: null, until: null, remaining: rule.end };

  if (rule.end.kind === "count") {
    return {
      recurrence: toRRule(
        { ...rule, end: { kind: "count", count: before } },
        series.allDay,
      ),
      until: lastEnd,
      remaining: { kind: "count", count: rule.end.count - before },
    };
  }
  // One occurrence per day at most, so ending the day before is exact.
  const dayBefore = addDays(formatDateKey(toLocal(originalStart, series)), -1);
  return {
    recurrence: toRRule(
      { ...rule, end: { kind: "until", date: dayBefore } },
      series.allDay,
    ),
    until: lastEnd,
    remaining: rule.end,
  };
}
