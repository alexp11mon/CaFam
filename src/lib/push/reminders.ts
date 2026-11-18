import { utcDateKey, zonedLocalToUtc } from "@/lib/calendar/time-zone";
import { occurrenceId } from "@/lib/recurrence/occurrence-id";
import { expandRows, type ExceptionKey } from "@/lib/recurrence/read-series";

// When reminders are due (spec 040 RF-5, RF-8 to RF-10, RF-12; plan D4).
// Server only: series are expanded with ical.js.

/** The choices of a reminder, in minutes before (RF-5). */
export const REMINDER_OPTIONS = {
  timed: [
    { minutes: 0, label: "Al empezar" },
    { minutes: 5, label: "5 minutos antes" },
    { minutes: 10, label: "10 minutos antes" },
    { minutes: 15, label: "15 minutos antes" },
    { minutes: 30, label: "30 minutos antes" },
    { minutes: 60, label: "1 hora antes" },
    { minutes: 120, label: "2 horas antes" },
    { minutes: 1440, label: "1 día antes" },
    { minutes: 2880, label: "2 días antes" },
    { minutes: 10080, label: "1 semana antes" },
  ],
  // All-day events: minutes before 9:00 of their day (RF-9).
  allDay: [
    { minutes: 0, label: "El mismo día a las 9:00" },
    { minutes: 1440, label: "El día anterior a las 9:00" },
    { minutes: 10080, label: "Una semana antes a las 9:00" },
  ],
} as const;

/** Defaults of a new profile (RF-6). */
export const DEFAULT_REMINDER = 10;
export const DEFAULT_ALL_DAY_REMINDER = 1440;
/** At most 3 per person and event (RF-5). */
export const MAX_REMINDERS = 3;
/** Later than this, a reminder is dropped (RF-10). */
export const LATE_MS = 15 * 60_000;
/** The cron runs each minute: a reminder can go this much early. */
export const EARLY_MS = 60_000;

/** An event (or series) with the reminders of one person. */
export interface ReminderRow {
  userId: string;
  eventId: string;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  recurrence: string | null;
  recurrenceTz: string | null;
  exdates: string[];
  /** The series of an exception: it warns with its own time (RF-8). */
  seriesId: string | null;
  minutes: number[];
  /** Zone of the person: all-day events warn at 9:00 there (RF-9). */
  timeZone: string;
}

export interface DueReminder {
  userId: string;
  /** What the notice opens: an occurrence id for a series (spec 013). */
  eventId: string;
  /** The row of the delivery key (RF-10). */
  deliveryEventId: string;
  occurrenceStart: string;
  minutes: number;
  at: string;
  title: string;
  location: string | null;
  startsAt: string;
  allDay: boolean;
  timeZone: string;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

/** When a reminder fires for an occurrence that starts at `startsAt`. */
export function reminderAt(
  startsAt: string,
  allDay: boolean,
  minutes: number,
  timeZone: string,
): number {
  if (!allDay) return Date.parse(startsAt) - minutes * MINUTE;
  const [year, month, day] = utcDateKey(startsAt).split("-").map(Number);
  const nine = zonedLocalToUtc(
    { year: year!, month: month!, day: day!, hour: 9, minute: 0 },
    timeZone,
  );
  return nine.getTime() - minutes * MINUTE;
}

/**
 * The reminders to send at `now`: those whose time is between 15 minutes ago
 * and 1 minute ahead (RF-10). `keys` are the exceptions of the series, whose
 * occurrences warn as their own rows (RF-8).
 */
export function dueReminders(
  rows: readonly ReminderRow[],
  keys: readonly ExceptionKey[],
  now: Date,
): DueReminder[] {
  const from = now.getTime() - LATE_MS;
  const to = now.getTime() + EARLY_MS;
  const due: DueReminder[] = [];

  for (const row of rows) {
    if (row.minutes.length === 0) continue;
    const longest = Math.max(...row.minutes) * MINUTE + 2 * DAY;
    const occurrences = row.recurrence
      ? expandRows(
          [
            {
              id: row.eventId,
              starts_at: row.startsAt,
              ends_at: row.endsAt,
              all_day: row.allDay,
              recurrence: row.recurrence,
              recurrence_tz: row.recurrenceTz,
              exdates: row.exdates,
            },
          ],
          keys,
          new Date(from - DAY),
          new Date(to + longest),
        ).map(({ occurrence }) => ({
          id: occurrenceId(row.eventId, occurrence.originalStart),
          startsAt: occurrence.startsAt,
        }))
      : [{ id: row.eventId, startsAt: row.startsAt }];

    for (const occurrence of occurrences) {
      for (const minutes of [...row.minutes].sort((a, b) => a - b)) {
        const fire = reminderAt(
          occurrence.startsAt,
          row.allDay,
          minutes,
          row.timeZone,
        );
        if (fire < from || fire > to) continue;
        due.push({
          userId: row.userId,
          eventId: occurrence.id,
          deliveryEventId: row.eventId,
          occurrenceStart: new Date(occurrence.startsAt).toISOString(),
          minutes,
          at: new Date(fire).toISOString(),
          title: row.title,
          location: row.location,
          startsAt: occurrence.startsAt,
          allDay: row.allDay,
          timeZone: row.timeZone,
        });
      }
    }
  }
  return due;
}
