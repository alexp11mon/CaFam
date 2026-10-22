// Pure layout of the agenda view: 14 days in a row, each with its events as
// rows of text (spec 005 RF-31..RF-36, RF-39, RF-43; plan agenda-layout, D6).
import { formatDateKeyFull, weekdayLabel } from "./format";
import { dayEvents, type LayoutEventInput } from "./layout";
import { formatTime, parseDateKey, zonedDateKey } from "./time-zone";

export interface AgendaEntry<T extends LayoutEventInput> {
  event: T;
  /** "Todo el día", "09:00" or, for an event that began earlier, "Desde el 2 nov a las 23:00". */
  start: string;
  /** "10:30", "Hasta el 3 nov a las 01:00", or null for all-day and zero-length events. */
  end: string | null;
}

export interface AgendaDay<T extends LayoutEventInput> {
  key: string;
  /** Day of the month with two digits, for the big number. */
  number: string;
  weekday: string;
  /** Full date read by screen readers (RF-33). */
  label: string;
  isToday: boolean;
  entries: AgendaEntry<T>[];
  /** Index of the first upcoming entry, where the now line goes; null outside today (RF-39). */
  nowIndex: number | null;
}

const ALL_DAY = "Todo el día";

const shortDate = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function shortDayLabel(dateKey: string): string {
  return shortDate.format(new Date(`${dateKey}T00:00:00Z`)).replace(".", "");
}

function entryFor<T extends LayoutEventInput>(
  event: T,
  dayKey: string,
  timeZone: string,
): AgendaEntry<T> {
  if (event.allDay) return { event, start: ALL_DAY, end: null };

  const startDay = zonedDateKey(event.startsAt, timeZone);
  const startTime = formatTime(event.startsAt, timeZone);
  const start =
    startDay === dayKey
      ? startTime
      : `Desde el ${shortDayLabel(startDay)} a las ${startTime}`;

  if (event.endsAt === event.startsAt) return { event, start, end: null };

  // An event ending exactly at midnight belongs to the day before (layout.ts).
  const endDay = zonedDateKey(Date.parse(event.endsAt) - 1, timeZone);
  const endTime = formatTime(event.endsAt, timeZone);
  const end =
    endDay === dayKey
      ? endTime
      : `Hasta el ${shortDayLabel(zonedDateKey(event.endsAt, timeZone))} a las ${endTime}`;
  return { event, start, end };
}

export function buildAgenda<T extends LayoutEventInput>({
  days,
  events,
  timeZone,
  today,
  now,
}: {
  days: readonly string[];
  events: readonly T[];
  timeZone: string;
  today: string;
  now?: Date;
}): AgendaDay<T>[] {
  return days.map((key) => {
    const items = dayEvents(events, key, timeZone);
    const isToday = key === today;
    let nowIndex: number | null = null;
    if (isToday && now) {
      // Banners come first and the rest is sorted by start (RF-34), so the
      // started entries are a prefix.
      const upcoming = items.findIndex(
        (item) =>
          !item.banner && Date.parse(item.event.startsAt) > now.getTime(),
      );
      nowIndex = upcoming === -1 ? items.length : upcoming;
    }
    return {
      key,
      number: String(parseDateKey(key)?.day ?? "").padStart(2, "0"),
      weekday: weekdayLabel(key),
      label: formatDateKeyFull(key),
      isToday,
      entries: items.map((item) => entryFor(item.event, key, timeZone)),
      nowIndex,
    };
  });
}
