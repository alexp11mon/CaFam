import type { RepeatPreset } from "@/lib/recurrence/presets";
import { nextWeekday, readDates } from "./dates";
import { readAllDay, readCalendar, readLocation, readRepeat } from "./extras";
import { readTimes } from "./times";
import { Scan, type Span } from "./tokenize";

// "Cena con Ana el viernes a las 21 en casa @familia" → the parts of a new
// event (spec 041, plan D1). Pure and with no dependencies (RNF-1).

export interface ParsedEvent {
  /** What is left, cleaned; "" when nothing is (RF-9). */
  title: string;
  date: string | null;
  /** Last day, inclusive, of a range of days (RF-6). */
  endDate: string | null;
  start: string | null;
  end: string | null;
  durationMinutes: number | null;
  allDay: boolean;
  location: string | null;
  calendarHint: string | null;
  repeat: RepeatPreset | null;
  /** "ayer" (RF-1). */
  past: boolean;
  /** "a las 5" read as 17:00 (RF-15). */
  assumedAfternoon: boolean;
  spans: Span[];
}

const PART_OF_DAY = { morning: "09:00", afternoon: "17:00", night: "21:00" };

// Loose words left at the ends of the title ("Cena con Ana el").
const EDGE_WORDS =
  "el|la|los|las|a|al|de|del|en|y|e|o|desde|hasta|para|por|sobre|durante";
const LEADING = new RegExp(
  `^(?:(?:${EDGE_WORDS})(?=\\s|$)|[\\s,;:·.-])+`,
  "iu",
);
const TRAILING = new RegExp(
  `(?:(?<=\\s|^)(?:${EDGE_WORDS})|[\\s,;:·.-])+$`,
  "iu",
);

function cleanTitle(scan: Scan): string {
  const rest = scan
    .runs()
    .map(({ start, end }) => scan.original.slice(start, end))
    .join(" ")
    .replace(/\s+/gu, " ");
  let title = rest;
  for (let i = 0; i < 4; i += 1) {
    title = title.replace(LEADING, "").replace(TRAILING, "");
  }
  title = title.trim();
  return title ? title[0]!.toLocaleUpperCase("es") + title.slice(1) : "";
}

/** `today` is the date in the zone of the profile ("2026-11-18"). */
export function parseEventText(text: string, today: string): ParsedEvent {
  const scan = new Scan(text);
  const calendarHint = readCalendar(scan);
  const repeat = readRepeat(scan);
  const dates = readDates(scan, today);
  const times = readTimes(scan);
  const saidAllDay = readAllDay(scan);
  const location = readLocation(scan);

  let date = dates.date;
  if (!date && repeat?.weekday != null) {
    date = nextWeekday(today, repeat.weekday, true);
  }
  let start = times.start;
  if (!start && !saidAllDay && dates.partOfDay) {
    start = PART_OF_DAY[dates.partOfDay];
  }
  const hasTime = Boolean(start || times.end || times.durationMinutes);
  // A date with no time is all day; so is a range of days (RF-6).
  const allDay =
    saidAllDay || Boolean(dates.endDate) || (Boolean(date) && !hasTime);

  return {
    title: cleanTitle(scan),
    date,
    endDate: dates.endDate,
    start: allDay ? null : start,
    end: allDay ? null : times.end,
    durationMinutes: allDay ? null : times.durationMinutes,
    allDay,
    location,
    calendarHint,
    repeat: repeat?.repeat ?? null,
    past: dates.past,
    assumedAfternoon: !allDay && times.assumedAfternoon,
    spans: [...scan.spans].sort((a, b) => a.start - b.start),
  };
}
