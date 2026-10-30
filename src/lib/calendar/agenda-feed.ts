// Pure layout of the continuous agenda: a band per month, a separator per week
// and only the days with events (spec 016 RF-47..RF-58, plan agenda-feed).
import { formatDateKeyFull, weekdayLabel } from "./format";
import { dayEvents, type LayoutEventInput } from "./layout";
import { addDays, formatTime, weekdayIndex } from "./time-zone";

export interface FeedEntry<T> {
  event: T;
  /** "A las 11:15–14:15 en <lugar>", "11:15–14:15", or null for all-day events. */
  line: string | null;
}

export type AgendaFeedItem<T> =
  | { kind: "month"; key: string; label: string }
  | { kind: "week"; key: string; label: string; empty: boolean }
  | {
      kind: "day";
      key: string;
      weekday: string;
      number: string;
      /** Full date for screen readers. */
      label: string;
      isToday: boolean;
      entries: FeedEntry<T>[];
    };

type Located = LayoutEventInput & { location?: string | null };

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1]!;
const dayNumber = (key: string) => String(Number(key.slice(8, 10)));

/** "2–8 de noviembre" or "26 de octubre – 1 de noviembre". */
export function weekLabel(first: string, last: string): string {
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return `${dayNumber(first)}–${dayNumber(last)} de ${monthName(last)}`;
  }
  return `${dayNumber(first)} de ${monthName(first)} – ${dayNumber(last)} de ${monthName(last)}`;
}

// Google writes "9:15", not "09:15".
const shortTime = (instant: string, timeZone: string) =>
  formatTime(instant, timeZone).replace(/^0(?=\d)/, "");

function lineOf(event: Located, timeZone: string): string | null {
  if (event.allDay) return null;
  const start = shortTime(event.startsAt, timeZone);
  const hours =
    event.endsAt === event.startsAt
      ? start
      : `${start}–${shortTime(event.endsAt, timeZone)}`;
  return event.location ? `A las ${hours} en ${event.location}` : hours;
}

export function buildAgendaFeed<T extends Located>({
  days,
  events,
  timeZone,
  today,
}: {
  /** Consecutive date keys. */
  days: readonly string[];
  events: readonly T[];
  timeZone: string;
  today: string;
}): AgendaFeedItem<T>[] {
  const feed: AgendaFeedItem<T>[] = [];
  let week: Extract<AgendaFeedItem<T>, { kind: "week" }> | null = null;

  days.forEach((key, index) => {
    const newMonth = index === 0 || key.endsWith("-01");
    if (newMonth) {
      const month = key.slice(0, 7);
      feed.push({
        kind: "month",
        key: month,
        label:
          month.slice(0, 4) === today.slice(0, 4)
            ? monthName(key)
            : `${monthName(key)} de ${month.slice(0, 4)}`,
      });
    }
    // A week is cut at the end of its month, so the band never splits it.
    if (newMonth || weekdayIndex(key) === 0) {
      let last = key;
      while (
        weekdayIndex(last) < 6 &&
        addDays(last, 1).slice(0, 7) === key.slice(0, 7)
      ) {
        last = addDays(last, 1);
      }
      week = { kind: "week", key, label: weekLabel(key, last), empty: true };
      feed.push(week);
    }

    const items = dayEvents(events, key, timeZone);
    if (items.length === 0) return;
    week!.empty = false;
    feed.push({
      kind: "day",
      key,
      weekday: weekdayLabel(key),
      number: dayNumber(key),
      label: formatDateKeyFull(key),
      isToday: key === today,
      entries: items.map(({ event }) => ({
        event,
        line: lineOf(event, timeZone),
      })),
    });
  });
  return feed;
}

/** Where the agenda opens: today or the first later day with events (RF-58). */
export function anchorDay<T>(
  feed: readonly AgendaFeedItem<T>[],
  today: string,
): string | null {
  return (
    feed.find((item) => item.kind === "day" && item.key >= today)?.key ?? null
  );
}
