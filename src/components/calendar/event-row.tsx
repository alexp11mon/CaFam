import Link from "next/link";
import type { AgendaEntry } from "@/lib/calendar/agenda";
import type { AgendaEvent } from "./agenda-view";

/**
 * An event as a row of text: times, a thin bar in its color, title and place.
 * The text stays in ink; the color only marks (spec 005 RF-4, RF-35, plan D15).
 */
export function EventRow({ entry }: { entry: AgendaEntry<AgendaEvent> }) {
  const { event, start, end } = entry;

  return (
    <Link
      href={`/dashboard/events/${event.id}`}
      className="grid grid-cols-[5.5rem_auto_1fr] gap-3 rounded-2xl bg-paper px-4 py-3 text-ink transition-colors hover:bg-paper/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:grid-cols-[7rem_auto_1fr]"
    >
      <span className="flex flex-col text-sm leading-snug tabular-nums">
        <span className="font-bold">{start}</span>
        {end ? <span className="text-muted">{end}</span> : null}
      </span>
      <span
        data-color-bar=""
        aria-hidden="true"
        style={{ backgroundColor: event.color }}
        className="w-1 self-stretch rounded-full ring-1 ring-pastel-ink/15 ring-inset"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 font-bold break-words">
          {event.title}
        </span>
        {event.location ? (
          <span className="truncate text-sm text-muted">{event.location}</span>
        ) : null}
        {event.calendarName ? (
          <span className="sr-only">Calendario {event.calendarName}</span>
        ) : null}
      </span>
    </Link>
  );
}
