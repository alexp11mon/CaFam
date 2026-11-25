import { formatEventWhen } from "@/lib/calendar/format";

export interface ShareableEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
}

/** "Cena con Ana · viernes, 20 de noviembre de 2026, 21:00 – 23:00 · Casa de Ana" (spec 047 RF-1). */
export function shareText(
  event: Pick<
    ShareableEvent,
    "title" | "startsAt" | "endsAt" | "allDay" | "location"
  >,
  timeZone: string,
): string {
  return [event.title, formatEventWhen(event, timeZone), event.location?.trim()]
    .filter(Boolean)
    .join(" · ");
}
