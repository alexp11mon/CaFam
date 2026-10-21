import Link from "next/link";
import { formatDateKeyFull, weekdayLabel } from "@/lib/calendar/format";
import {
  dayEvents,
  splitVisible,
  type CalendarEventItem,
} from "@/lib/calendar/layout";
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
}: {
  /** Reference date: days of other months are dimmed. */
  date: string;
  days: string[];
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
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
        className="grid grid-cols-7 text-center text-xs font-semibold text-ink/70"
      >
        {days.slice(0, 7).map((day) => (
          <span key={day}>{weekdayLabel(day)}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-ink/15 bg-ink/15">
        {perDay.map(({ day, visible, hidden }) => (
          <li
            key={day}
            data-testid="day-cell"
            data-date={day}
            className={`flex min-h-20 min-w-0 flex-col gap-1 p-1 ${day.slice(0, 7) === month ? "bg-white" : "bg-ink/5"}`}
          >
            <Link
              href={calendarHref("day", day)}
              aria-label={formatDateKeyFull(day)}
              aria-current={day === today ? "date" : undefined}
              className={`inline-flex size-7 items-center justify-center self-start rounded-full text-sm font-semibold ${day === today ? "bg-brand text-white" : "text-ink"}`}
            >
              {Number(day.slice(8))}
            </Link>
            <ul className="flex min-w-0 flex-col gap-0.5">
              {visible.map(({ event }) => (
                <li key={event.id} className="min-w-0">
                  <EventChip event={event} timeZone={timeZone} compact />
                </li>
              ))}
            </ul>
            {hidden > 0 ? (
              <Link
                href={calendarHref("day", day)}
                className="text-xs font-semibold text-brand underline"
              >
                +{hidden} más
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
      {isEmpty ? (
        <p className="text-center text-ink/70">No hay eventos</p>
      ) : null}
    </div>
  );
}
