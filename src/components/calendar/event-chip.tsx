import Link from "next/link";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { formatTime } from "@/lib/calendar/time-zone";
import { ImageIcon } from "@/components/shell/icons";

/**
 * Mark of an event with images (spec 012 RF-12). The words always reach
 * screen readers; the icon only where it fits.
 */
export function ImageMark({
  count,
  icon = true,
}: {
  count?: number;
  icon?: boolean;
}) {
  if (!count) return null;
  return (
    <>
      {icon ? (
        <>
          {" "}
          <ImageIcon />
        </>
      ) : null}
      <span className="sr-only"> Con imágenes</span>
    </>
  );
}

/**
 * One event as a link to its detail (RF-17, RF-36). The text stays in ink.
 * - `chip`: color as a bar on the left (spec 005 RF-4, plan D15).
 * - `dot`: a timed event of the month, a dot of its color, the hour and the title.
 * - `bar`: an all-day or multi-day event of the month, filled with its pastel
 *   color (spec 008 RF-48, plan D9, the P9 amendment).
 * On a phone the month only shows the dot or the bar; the text stays for screen readers.
 */
export function EventChip({
  event,
  timeZone,
  variant = "chip",
}: {
  event: CalendarEventItem;
  timeZone: string;
  variant?: "chip" | "dot" | "bar";
}) {
  const time = event.allDay ? null : formatTime(event.startsAt, timeZone);

  if (variant === "dot") {
    return (
      <Link
        href={`/dashboard/events/${event.id}`}
        className="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs text-ink hover:bg-stone"
      >
        <span
          data-testid="event-dot"
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full ring-1 ring-pastel-ink/15"
          style={{ backgroundColor: event.color }}
        />
        {/* not-sr-only allows wrapping again: one line with an ellipsis, as Google. */}
        <span className="sr-only min-w-0 sm:not-sr-only sm:truncate">
          <span className="font-semibold tabular-nums">{time}</span>
          {/* Before the title: the ellipsis of a long one would hide it. */}
          <ImageMark count={event.imageCount} /> {event.title}
        </span>
      </Link>
    );
  }

  if (variant === "bar") {
    return (
      <Link
        href={`/dashboard/events/${event.id}`}
        style={{ backgroundColor: event.color }}
        className="block h-1.5 truncate rounded-md text-xs font-semibold text-pastel-ink ring-1 ring-pastel-ink/15 sm:h-auto sm:px-1.5 sm:py-0.5"
      >
        <span className="sr-only sm:not-sr-only sm:block sm:truncate">
          <ImageMark count={event.imageCount} /> {event.title}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/dashboard/events/${event.id}`}
      style={{ borderLeftColor: event.color }}
      className="block truncate rounded-md border-l-4 bg-stone px-1.5 py-0.5 text-xs font-medium text-ink ring-1 ring-ink/10"
    >
      {time ? `${time} ` : null}
      {event.title}
      <ImageMark count={event.imageCount} />
    </Link>
  );
}
