import Link from "next/link";
import { formatDateKeyFull, weekdayLabel } from "@/lib/calendar/format";
import {
  dayEvents,
  layoutTimedDay,
  type CalendarEventItem,
} from "@/lib/calendar/layout";
import { readableTextColor } from "@/lib/calendar/palette";
import { calendarHref } from "@/lib/calendar/ranges";
import { formatTime } from "@/lib/calendar/time-zone";
import { EventChip } from "./event-chip";
import { ScrollOnMount } from "./scroll-on-mount";

const HOUR_PX = 48;
const MIN_SLOT_PX = 22;
const FIRST_VISIBLE_HOUR = 7;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const percent = (value: number) => `${Number(value.toFixed(4))}%`;

/**
 * Hour grid shared by the week and day views: a strip for all-day and multi-day
 * events and a column per day with side-by-side overlaps (RF-35, RF-40).
 */
export function TimeGrid({
  days,
  events,
  timeZone,
  today,
  linkDays,
}: {
  days: string[];
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
  /** Header numbers link to the day view; off when the day view is already open. */
  linkDays: boolean;
}) {
  const columns = {
    gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))`,
  };
  const perDay = days.map((day) => ({
    day,
    banners: dayEvents(events, day, timeZone).filter((item) => item.banner),
    slots: layoutTimedDay(events, day, timeZone),
  }));
  const hasBanners = perDay.some((cell) => cell.banners.length > 0);
  const isEmpty = days.every(
    (day) => dayEvents(events, day, timeZone).length === 0,
  );

  return (
    <div className="flex flex-col gap-3">
      {/* The grid scrolls on its own so a narrow screen never scrolls the whole page. */}
      <div className="overflow-x-auto rounded-lg border border-ink/15">
        <div style={{ minWidth: days.length > 1 ? "40rem" : undefined }}>
          <div className="grid border-b border-ink/15" style={columns}>
            <div />
            {perDay.map(({ day }) => (
              <div
                key={day}
                data-testid="day-header"
                className="flex flex-col items-center py-1 text-xs font-semibold text-ink/70"
              >
                <span>{weekdayLabel(day)}</span>
                {linkDays ? (
                  <Link
                    href={calendarHref("day", day)}
                    aria-label={formatDateKeyFull(day)}
                    aria-current={day === today ? "date" : undefined}
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${day === today ? "bg-brand text-white" : "text-ink"}`}
                  >
                    {Number(day.slice(8))}
                  </Link>
                ) : (
                  <span
                    aria-current={day === today ? "date" : undefined}
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${day === today ? "bg-brand text-white" : "text-ink"}`}
                  >
                    {Number(day.slice(8))}
                  </span>
                )}
              </div>
            ))}
          </div>
          {hasBanners ? (
            <div
              data-testid="banner-strip"
              className="grid border-b border-ink/15 bg-brand-soft/20"
              style={columns}
            >
              <span className="p-1 text-[11px] text-ink/70">Todo el día</span>
              {perDay.map(({ day, banners }) => (
                <ul key={day} className="flex min-w-0 flex-col gap-0.5 p-0.5">
                  {banners.map(({ event }) => (
                    <li key={event.id} className="min-w-0">
                      <EventChip event={event} timeZone={timeZone} />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          ) : null}
          <ScrollOnMount
            top={FIRST_VISIBLE_HOUR * HOUR_PX}
            className="max-h-[28rem] overflow-y-auto"
          >
            <div data-testid="time-grid" className="grid" style={columns}>
              <div>
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{ height: HOUR_PX }}
                    className="border-t border-transparent pr-1 text-right text-[11px] text-ink/70"
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {perDay.map(({ day, slots }) => (
                <div
                  key={day}
                  className="relative border-l border-ink/15"
                  style={{ height: 24 * HOUR_PX }}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      aria-hidden="true"
                      style={{ height: HOUR_PX }}
                      className="border-t border-ink/10"
                    />
                  ))}
                  {slots.map((slot) => {
                    const width = 100 / slot.columns;
                    return (
                      <Link
                        key={slot.event.id}
                        href={`/dashboard/events/${slot.event.id}`}
                        style={{
                          top: `${(slot.startMinute / 60) * HOUR_PX}px`,
                          height: `${Math.max(((slot.endMinute - slot.startMinute) / 60) * HOUR_PX, MIN_SLOT_PX)}px`,
                          left: percent(slot.column * width),
                          width: percent(width),
                          backgroundColor: slot.event.color,
                          color: readableTextColor(slot.event.color),
                        }}
                        className="absolute overflow-hidden rounded border border-white/70 px-1 text-xs"
                      >
                        <span className="font-semibold">
                          {formatTime(slot.event.startsAt, timeZone)}
                        </span>{" "}
                        {slot.event.title}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollOnMount>
        </div>
      </div>
      {isEmpty ? (
        <p className="text-center text-ink/70">No hay eventos</p>
      ) : null}
    </div>
  );
}
