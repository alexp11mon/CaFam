// The "Próximo evento" block: the next timed event of the visible calendars
// and how much is left (spec 005 RF-45, RF-46, RF-48, RF-49; plan D12).

export interface NextEventInput {
  id: string;
  calendarId: string;
  startsAt: string;
  allDay: boolean;
}

export const NEXT_EVENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** First timed event not started yet that starts within 24 h, or null. */
export function pickNextEvent<T extends NextEventInput>(
  events: readonly T[],
  now: Date,
  visibleCalendarIds: ReadonlySet<string>,
): T | null {
  const from = now.getTime();
  let next: T | null = null;
  for (const event of events) {
    const start = Date.parse(event.startsAt);
    if (
      event.allDay ||
      !visibleCalendarIds.has(event.calendarId) ||
      start <= from ||
      start > from + NEXT_EVENT_WINDOW_MS
    ) {
      continue;
    }
    if (!next || start < Date.parse(next.startsAt)) next = event;
  }
  return next;
}

/** "en menos de 1 min", "en 25 min", "en 1 h", "en 3 h 10 min". */
export function formatCountdown(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "en menos de 1 min";
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `en ${hours} h` : `en ${hours} h ${rest} min`;
}

// The server sends 48 h so the block stays right while the page is open (plan D12).
const LOAD_WINDOW_MS = 2 * NEXT_EVENT_WINDOW_MS;

/** Instants the server reads for the next event block, and when it read them. */
export function nextEventsWindow(now: number = Date.now()): {
  from: Date;
  to: Date;
  loadedAt: number;
} {
  return {
    from: new Date(now),
    to: new Date(now + LOAD_WINDOW_MS),
    loadedAt: now,
  };
}
