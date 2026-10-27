import { buildRow, dayStart, type ConvertResult } from "./event-row";

// Google Calendar `events.list` items, asked with singleEvents=true so each
// repetition arrives with its own id (plan D8).
interface GoogleTime {
  date?: string;
  dateTime?: string;
}

export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleTime;
  end?: GoogleTime;
}

/** `dateTime` is RFC 3339 with its offset, so Date.parse gives the instant. */
function instant(time: GoogleTime | undefined): number | null {
  if (!time) return null;
  return time.date
    ? dayStart(time.date)
    : time.dateTime
      ? Date.parse(time.dateTime)
      : null;
}

/** Turns Google events into rows; cancelled ones are dropped, invalid ones counted (RF-16..RF-18). */
export function convertGoogleEvents(items: GoogleEvent[]): ConvertResult {
  const result: ConvertResult = { events: [], skipped: 0 };

  for (const item of items) {
    if (item.status === "cancelled") continue;
    const row = buildRow({
      id: item.id,
      title: item.summary,
      description: item.description,
      location: item.location,
      start: instant(item.start),
      end: instant(item.end),
      allDay: Boolean(item.start?.date),
    });
    if (row) result.events.push(row);
    else result.skipped++;
  }

  return result;
}
