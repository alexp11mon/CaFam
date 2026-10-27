import { zonedLocalToUtc } from "@/lib/calendar/time-zone";
import { isKnownTimeZone } from "@/lib/ics/convert-events";
import { buildRow, dayStart, type ConvertResult } from "./event-row";

// Microsoft Graph `calendarView` items, asked with Prefer: outlook.timezone="UTC"
// so each occurrence arrives expanded with its own id (plan D8, R8).
interface GraphTime {
  dateTime: string;
  timeZone: string;
}

export interface MicrosoftEvent {
  id: string;
  subject?: string | null;
  isCancelled?: boolean;
  isAllDay?: boolean;
  body?: { content?: string | null } | null;
  location?: { displayName?: string | null } | null;
  start?: GraphTime;
  end?: GraphTime;
}

/** Graph gives a wall time plus a zone name; Windows names are not known (RF-18). */
function instant(time: GraphTime | undefined): number | null {
  if (!time) return null;
  if (time.timeZone === "UTC")
    return Date.parse(`${time.dateTime.slice(0, 19)}Z`);
  if (!isKnownTimeZone(time.timeZone)) return null;
  const [date, clock] = time.dateTime.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  return zonedLocalToUtc(
    { year, month, day, hour, minute },
    time.timeZone,
  ).getTime();
}

/** Turns Graph events into rows; cancelled ones are dropped, invalid ones counted (RF-16..RF-18). */
export function convertMicrosoftEvents(items: MicrosoftEvent[]): ConvertResult {
  const result: ConvertResult = { events: [], skipped: 0 };

  for (const item of items) {
    if (item.isCancelled) continue;
    const allDay = Boolean(item.isAllDay);
    // All-day events asked in UTC sit at 00:00 UTC: keep only the date (R8).
    const at = (time: GraphTime | undefined) =>
      allDay && time ? dayStart(time.dateTime) : instant(time);
    const row = buildRow({
      id: item.id,
      title: item.subject,
      description: item.body?.content,
      location: item.location?.displayName,
      start: at(item.start),
      end: at(item.end),
      allDay,
    });
    if (row) result.events.push(row);
    else result.skipped++;
  }

  return result;
}
