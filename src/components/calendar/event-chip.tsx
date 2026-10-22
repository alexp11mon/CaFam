import Link from "next/link";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { formatTime } from "@/lib/calendar/time-zone";

/**
 * One event as a link to its detail (RF-17, RF-36). The text stays in ink and
 * its color is a bar on the left (spec 005 RF-4, plan D15).
 */
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
        borderLeftColor: event.color,
        // On a phone the compact chip is only the bar, filled with the color.
        ["--chip-color" as string]: event.color,
      }}
      className={`block truncate rounded-md border-l-4 bg-stone px-1.5 text-xs font-medium text-ink ring-1 ring-ink/10 ${compact ? "h-1.5 overflow-hidden max-sm:bg-(--chip-color) sm:h-auto sm:py-0.5" : "py-0.5"}`}
    >
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
        {event.allDay ? null : `${formatTime(event.startsAt, timeZone)} `}
        {event.title}
      </span>
    </Link>
  );
}
