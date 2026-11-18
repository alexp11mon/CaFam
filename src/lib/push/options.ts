// The choices of a reminder, shared by the browser and the server (spec 040
// RF-5, RF-6). Pure.

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

export function reminderOptions(allDay: boolean) {
  return allDay ? REMINDER_OPTIONS.allDay : REMINDER_OPTIONS.timed;
}

const ALL = new Set<number>(REMINDER_OPTIONS.timed.map((o) => o.minutes));

/**
 * The `reminders` field of the event form: "none" or "10,60". Null when it
 * is missing or not valid: then nothing is written.
 */
export function parseReminders(
  raw: FormDataEntryValue | null,
): number[] | null {
  if (typeof raw !== "string" || raw === "") return null;
  if (raw === "none") return [];
  const minutes = [...new Set(raw.split(",").map(Number))];
  if (minutes.length > MAX_REMINDERS) return null;
  return minutes.every((m) => ALL.has(m))
    ? minutes.sort((a, b) => a - b)
    : null;
}

/** Only the choices that exist for the kind of event. */
export function validFor(
  allDay: boolean,
  minutes: readonly number[],
): number[] {
  const options = new Set<number>(
    reminderOptions(allDay).map((o) => o.minutes),
  );
  return minutes.filter((m) => options.has(m));
}
