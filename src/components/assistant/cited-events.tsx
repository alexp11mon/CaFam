import Link from "next/link";
import type { CitedEvent } from "@/lib/assistant/tools";
import { formatEventWhen } from "@/lib/calendar/format";
import { StaggerList } from "@/components/ui/stagger-list";

/** Events an answer is based on, each one a link to its detail (spec 015 RF-11). */
export function CitedEvents({
  events,
  timeZone,
}: {
  events: readonly CitedEvent[];
  timeZone: string;
}) {
  if (events.length === 0) return null;
  return (
    // They land just after the answer, one after another (spec 021 RF-16, RF-19).
    <StaggerList
      className="settle mt-3 flex flex-col gap-2"
      aria-label="Eventos citados"
    >
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/dashboard/events/${event.id}`}
            className="flex min-h-11 items-stretch gap-3 rounded-2xl border border-line bg-stone/60 p-2 pr-3 text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {/* The calendar's color is data, so it goes in style (P9). */}
            <span
              aria-hidden="true"
              className="w-1 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
              style={{ backgroundColor: event.color }}
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{event.title}</span>
              <span className="text-sm text-muted tabular-nums">
                {formatEventWhen(event, timeZone)} · {event.calendarName}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </StaggerList>
  );
}
