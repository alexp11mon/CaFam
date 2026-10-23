import Link from "next/link";
import { formatDateKeyFull, weekdayLabel } from "@/lib/calendar/format";
import {
  dayEvents,
  splitVisible,
  type CalendarEventItem,
} from "@/lib/calendar/layout";
import { boxOf, type Box } from "@/lib/calendar/popover";
import { calendarHref } from "@/lib/calendar/ranges";
import { EventChip } from "./event-chip";

const MAX_VISIBLE = 3;

/** Month grid, Monday first: events per day, "+N más" and a link to the day view (RF-37..RF-39). */
export function MonthView({
  date,
  days,
  events,
  timeZone,
  today,
  onCreate,
  draft,
}: {
  /** Reference date: days of other months are dimmed. */
  date: string;
  days: string[];
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
  /** Opens the quick window on an empty day; absent for readers (spec 008 RF-19, RF-36). */
  onCreate?: (day: string, anchor: Box) => void;
  /** The event being created, shown in its day (spec 008 RF-40). */
  draft?: { day: string; title: string } | null;
}) {
  const month = date.slice(0, 7);
  const perDay = days.map((day) => ({
    day,
    ...splitVisible(dayEvents(events, day, timeZone), MAX_VISIBLE),
  }));
  const isEmpty = perDay.every((cell) => cell.visible.length === 0);

  return (
    <div className="flex flex-col gap-3">
      <div
        aria-hidden="true"
        className="grid grid-cols-7 text-center text-xs font-semibold text-muted"
      >
        {days.slice(0, 7).map((day) => (
          <span key={day}>{weekdayLabel(day)}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-px overflow-hidden rounded-3xl bg-line">
        {perDay.map(({ day, visible, hidden }) => (
          <li
            key={day}
            data-testid="day-cell"
            data-date={day}
            className={`relative flex min-h-20 min-w-0 flex-col gap-1 p-1 ${day.slice(0, 7) === month ? "bg-paper" : "bg-stone"}`}
          >
            {onCreate ? (
              // The whole empty space creates; the number and the events sit above it (RF-19, RF-22).
              <button
                type="button"
                aria-label={`Crear evento el ${formatDateKeyFull(day)}`}
                onClick={(event) => onCreate(day, boxOf(event.currentTarget))}
                className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
              />
            ) : null}
            <Link
              href={calendarHref("day", day)}
              aria-label={formatDateKeyFull(day)}
              aria-current={day === today ? "date" : undefined}
              className={`relative inline-flex size-7 items-center justify-center self-start rounded-full text-sm font-semibold ${day === today ? "border border-accent-edge bg-accent font-extrabold text-on-accent" : "text-ink"}`}
            >
              {Number(day.slice(8))}
            </Link>
            {/* Gaps between events still reach the create button below. */}
            <ul className="pointer-events-none relative flex min-w-0 flex-col gap-0.5">
              {visible.map(({ event, banner }) => (
                <li key={event.id} className="pointer-events-auto min-w-0">
                  {/* All-day and multi-day as a bar, timed as a dot (spec 008 RF-48). */}
                  <EventChip
                    event={event}
                    timeZone={timeZone}
                    variant={banner ? "bar" : "dot"}
                  />
                </li>
              ))}
              {draft?.day === day ? (
                <li
                  aria-hidden="true"
                  className="truncate rounded-md border border-dashed border-ink bg-paper px-1.5 py-0.5 text-xs font-semibold text-ink"
                >
                  {draft.title || "(Sin título)"}
                </li>
              ) : null}
            </ul>
            {hidden > 0 ? (
              <Link
                href={calendarHref("day", day)}
                className="relative text-xs font-semibold text-ink underline decoration-control underline-offset-4 hover:decoration-ink"
              >
                +{hidden} más
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
      {isEmpty ? (
        <p className="text-center text-muted">No hay eventos</p>
      ) : null}
    </div>
  );
}
