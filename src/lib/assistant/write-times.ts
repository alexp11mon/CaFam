import {
  addDays,
  allDayToRange,
  formatTime,
  parseDateKey,
  utcDateKey,
  zonedDateKey,
  zonedLocalToUtc,
} from "@/lib/calendar/time-zone";

// Spec 036, RF-4 to RF-11, RF-16 and RF-26: the hours of an event created or
// changed from the chat. The model only says wall hours and which event it
// is relative to; the instants are worked out here (plan D1). Pure.

export interface TimeInput {
  date?: string | null;
  start?: string | null;
  end?: string | null;
  endDate?: string | null;
  allDay?: boolean | null;
  durationMinutes?: number | null;
}

export interface Times {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export interface TimeContext {
  timeZone: string;
  /** default_event_minutes of Ajustes (spec 019), for new events (RF-4). */
  defaultMinutes: number;
  /** The event as it is now, when changing it (RF-26). */
  base?: Times;
  /** Starts when this one ends: "cuando acabe X" (RF-9). */
  after?: Times;
  /** Ends when this one starts: "justo antes de X", "hasta X" (RF-10, RF-11). */
  before?: Times;
}

export type TimeResult =
  | ({ status: "ok" } & Times)
  | { status: "end_before_start"; date: string; start: string; end: string }
  | { status: "anchor_all_day" }
  | { status: "need_time" }
  | { status: "need_date" }
  | { status: "invalid" };

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const TIME = /^(\d{1,2}):(\d{2})$/;

function clock(text: string): { hour: number; minute: number } | null {
  const match = TIME.exec(text);
  if (!match) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

const iso = (ms: number) => new Date(ms).toISOString();

export function resolveTimes(
  input: TimeInput,
  context: TimeContext,
): TimeResult {
  const { timeZone, base, after, before } = context;
  // RF-16: an all-day event has no hour to start or end at.
  if (after?.allDay || before?.allDay) return { status: "anchor_all_day" };
  for (const key of [input.date, input.endDate]) {
    if (key && !parseDateKey(key)) return { status: "invalid" };
  }
  for (const text of [input.start, input.end]) {
    if (text && !clock(text)) return { status: "invalid" };
  }
  const at = (date: string, time: string) => {
    const day = parseDateKey(date)!;
    return zonedLocalToUtc({ ...day, ...clock(time)! }, timeZone).getTime();
  };

  const timedGiven = Boolean(
    input.start || input.end || after || before || input.durationMinutes,
  );
  const allDay =
    input.allDay ?? (timedGiven ? false : base ? base.allDay : null);
  const baseDay = base
    ? base.allDay
      ? utcDateKey(base.startsAt)
      : zonedDateKey(base.startsAt, timeZone)
    : null;

  if (allDay === null) {
    // A new event with no hours and not said to be all day (RF-5).
    return { status: input.date ? "need_time" : "need_date" };
  }

  if (allDay) {
    const first = input.date ?? baseDay;
    if (!first) return { status: "need_date" };
    // A multi-day event keeps its length when it moves.
    const length =
      base?.allDay && !input.endDate
        ? Math.round(
            (Date.parse(base.endsAt) - Date.parse(base.startsAt)) / DAY_MS,
          ) - 1
        : 0;
    const last = input.endDate ?? addDays(first, Math.max(0, length));
    if (last < first) return { status: "invalid" };
    return { status: "ok", ...allDayToRange(first, last), allDay: true };
  }

  const timedBase = base && !base.allDay ? base : null;
  const durationMs =
    (input.durationMinutes ??
      (timedBase
        ? (Date.parse(timedBase.endsAt) - Date.parse(timedBase.startsAt)) /
          MINUTE_MS
        : context.defaultMinutes)) * MINUTE_MS;
  const day =
    input.date ??
    (after
      ? zonedDateKey(after.endsAt, timeZone)
      : before
        ? zonedDateKey(before.startsAt, timeZone)
        : baseDay);

  let start: number | null = null;
  if (after) start = Date.parse(after.endsAt);
  else if (input.start) {
    if (!day) return { status: "need_date" };
    start = at(day, input.start);
  } else if (timedBase && !before) {
    // RF-26: a change keeps the hour; a new day moves it there.
    start = input.date
      ? at(input.date, formatTime(timedBase.startsAt, timeZone))
      : Date.parse(timedBase.startsAt);
  }

  let end: number | null = null;
  if (before) end = Date.parse(before.startsAt);
  else if (input.end) {
    const endDay =
      input.endDate ?? (start !== null ? zonedDateKey(start, timeZone) : day);
    if (!endDay) return { status: "need_date" };
    end = at(endDay, input.end);
  } else if (start !== null) end = start + durationMs;

  if (start === null && end !== null) start = end - durationMs;
  if (start === null || end === null) {
    return { status: day ? "need_time" : "need_date" };
  }
  // RF-8: said with both hours.
  if (end <= start) {
    return {
      status: "end_before_start",
      date: zonedDateKey(start, timeZone),
      start: formatTime(start, timeZone),
      end: formatTime(end, timeZone),
    };
  }
  return {
    status: "ok",
    startsAt: iso(start),
    endsAt: iso(end),
    allDay: false,
  };
}
