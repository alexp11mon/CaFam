import Link from "next/link";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { readableTextColor } from "@/lib/calendar/palette";
import { formatTime } from "@/lib/calendar/time-zone";

/** One event as a colored link to its detail (RF-17, RF-36); text color keeps 4.5:1 contrast. */
export function EventChip({
  event,
  timeZone,
  compact = false,
}: {
  event: CalendarEventItem;
  timeZone: string;
  /** On narrow screens month cells only show a colored bar; the text stays for screen readers. */
  compact?: boolean;
}) {
  return (
    <Link
      href={`/dashboard/events/${event.id}`}
      style={{
        backgroundColor: event.color,
        color: readableTextColor(event.color),
      }}
      className={`block truncate rounded px-1.5 text-xs font-medium ${compact ? "h-1.5 overflow-hidden sm:h-auto sm:py-0.5" : "py-0.5"}`}
    >
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
        {event.allDay ? null : `${formatTime(event.startsAt, timeZone)} `}
        {event.title}
      </span>
    </Link>
  );
}
