import {
  matchCalendar,
  type MatchableCalendar,
} from "@/lib/assistant/calendar-match";
import { clampEnd, fromMinutes, toMinutes } from "@/lib/calendar/time-options";
import {
  addDays,
  parseDateKey,
  zonedDateKey,
  zonedLocalToUtc,
} from "@/lib/calendar/time-zone";
import type { RepeatPreset } from "@/lib/recurrence/presets";
import type { ParsedEvent } from "./parse";

// A parsed phrase → the values of the event form (spec 041 RF-12). Pure.

export interface ResolvedEvent {
  /** "" when the phrase left none: the form keeps its own (RF-9). */
  title: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string | null;
  /** Only when "@nombre" names one writable calendar (RF-8). */
  calendarId: string | null;
  calendarName: string | null;
  repeat: RepeatPreset | null;
  warnings: string[];
}

export interface ResolveContext {
  timeZone: string;
  /** The account's length of a new event (spec 019 RF-32). */
  defaultMinutes: number;
  calendars: readonly MatchableCalendar[];
  /** What the form shows now: the slot that was pressed, or today. */
  fallback: { date: string; startTime: string };
}

const MINUTES_IN_DAY = 24 * 60;

function calendarOf(
  hint: string | null,
  calendars: ResolveContext["calendars"],
) {
  if (!hint) return { id: null, name: null, warning: null };
  const match = matchCalendar(hint, calendars);
  switch (match.status) {
    case "ok":
      return {
        id: match.calendar.id,
        name: match.calendar.name,
        warning: null,
      };
    case "ambiguous":
      return {
        id: null,
        name: null,
        warning: `Hay varios calendarios «${hint}»: ${match.options.join(", ")}.`,
      };
    case "read_only":
      return {
        id: null,
        name: null,
        warning: `En «${match.name}» no puedes crear eventos.`,
      };
    default:
      return {
        id: null,
        name: null,
        warning: `No hay ningún calendario «${hint}».`,
      };
  }
}

/** A time that does not exist on that day, when the clocks go forward. */
function skipped(date: string, time: string, timeZone: string): string | null {
  const parts = parseDateKey(date)!;
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  const instant = zonedLocalToUtc({ ...parts, hour, minute }, timeZone);
  const wall = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return wall !== time && zonedDateKey(instant, timeZone) === date
    ? wall
    : null;
}

export function resolveParsed(
  parsed: ParsedEvent,
  context: ResolveContext,
): ResolvedEvent {
  const warnings: string[] = [];
  const startDate = parsed.date ?? context.fallback.date;
  const calendar = calendarOf(parsed.calendarHint, context.calendars);
  if (calendar.warning) warnings.push(calendar.warning);
  if (parsed.past) warnings.push("La fecha ya ha pasado.");

  const common = {
    title: parsed.title,
    location: parsed.location,
    calendarId: calendar.id,
    calendarName: calendar.name,
    repeat: parsed.repeat,
  };

  if (parsed.allDay) {
    return {
      ...common,
      startDate,
      endDate: parsed.endDate ?? startDate,
      startTime: context.fallback.startTime,
      endTime: fromMinutes(
        clampEnd(
          toMinutes(context.fallback.startTime) + context.defaultMinutes,
        ),
      ),
      allDay: true,
      warnings,
    };
  }

  const length = parsed.durationMinutes ?? context.defaultMinutes;
  let start =
    parsed.start ??
    (parsed.end
      ? fromMinutes(Math.max(0, toMinutes(parsed.end) - length))
      : context.fallback.startTime);
  const moved = skipped(startDate, start, context.timeZone);
  if (moved) {
    warnings.push(
      `Ese día las ${start} no existen por el cambio de hora: empieza a las ${moved}.`,
    );
    start = moved;
  }
  if (parsed.assumedAfternoon) {
    warnings.push(`Se entiende por la tarde: ${start}.`);
  }

  const startMinutes = toMinutes(start);
  let endMinutes = parsed.end ? toMinutes(parsed.end) : startMinutes + length;
  // "de 22 a 1": the end is on the next day.
  if (parsed.end && endMinutes <= startMinutes) endMinutes += MINUTES_IN_DAY;
  const days = Math.floor(endMinutes / MINUTES_IN_DAY);
  // A duration past midnight without an end stops at the end of the day.
  const endTime = parsed.end
    ? fromMinutes(endMinutes % MINUTES_IN_DAY)
    : fromMinutes(clampEnd(endMinutes));

  return {
    ...common,
    startDate,
    endDate: parsed.end ? addDays(startDate, days) : startDate,
    startTime: start,
    endTime,
    allDay: false,
    warnings,
  };
}
