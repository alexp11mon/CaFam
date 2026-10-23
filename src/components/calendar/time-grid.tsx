import Link from "next/link";
import { formatDateKeyFull, weekdayLabel } from "@/lib/calendar/format";
import {
  dayEvents,
  layoutTimedDay,
  type CalendarEventItem,
} from "@/lib/calendar/layout";
import type { Box } from "@/lib/calendar/popover";
import { calendarHref } from "@/lib/calendar/ranges";
import type { MinuteRange } from "@/lib/calendar/slots";
import { fromMinutes } from "@/lib/calendar/time-options";
import { formatTime } from "@/lib/calendar/time-zone";
import { EventChip } from "./event-chip";
import { ScrollOnMount } from "./scroll-on-mount";
import { SlotLayer } from "./slot-layer";

/** The event being created, drawn at its hours (spec 008 RF-40). */
export interface GridDraft {
  day: string;
  startMinute: number;
  endMinute: number;
  title: string;
}

export type CreateInGrid = (
  day: string,
  range: MinuteRange,
  anchor: Box,
) => void;

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
  onCreate,
  draft,
}: {
  days: string[];
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
  /** Header numbers link to the day view; off when the day view is already open. */
  linkDays: boolean;
  /** Click or drag on an empty slot; absent for readers (spec 008 RF-20, RF-36). */
  onCreate?: CreateInGrid;
  draft?: GridDraft | null;
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
      <div className="overflow-x-auto rounded-3xl bg-paper">
        <div style={{ minWidth: days.length > 1 ? "40rem" : undefined }}>
          <div className="grid border-b border-line" style={columns}>
            <div />
            {perDay.map(({ day }) => (
              <div
                key={day}
                data-testid="day-header"
                className="flex flex-col items-center py-1 text-xs font-semibold text-muted"
              >
                <span>{weekdayLabel(day)}</span>
                {linkDays ? (
                  <Link
                    href={calendarHref("day", day)}
                    aria-label={formatDateKeyFull(day)}
                    aria-current={day === today ? "date" : undefined}
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${day === today ? "border border-accent-edge bg-accent font-extrabold text-on-accent" : "text-ink"}`}
                  >
                    {Number(day.slice(8))}
                  </Link>
                ) : (
                  <span
                    aria-current={day === today ? "date" : undefined}
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${day === today ? "border border-accent-edge bg-accent font-extrabold text-on-accent" : "text-ink"}`}
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
              className="grid border-b border-line bg-stone"
              style={columns}
            >
              <span className="p-1 text-[11px] text-muted">Todo el día</span>
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
                    className="border-t border-transparent pr-1 text-right text-[11px] text-muted"
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {perDay.map(({ day, slots }) => (
                <div
                  key={day}
                  className="relative border-l border-line"
                  style={{ height: 24 * HOUR_PX }}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      aria-hidden="true"
                      style={{ height: HOUR_PX }}
                      className="border-t border-line"
                    />
                  ))}
                  {onCreate ? (
                    <SlotLayer
                      day={day}
                      dayLabel={formatDateKeyFull(day)}
                      onCreate={onCreate}
                    />
                  ) : null}
                  {draft?.day === day ? (
                    <div
                      data-testid="draft-block"
                      aria-hidden="true"
                      style={{
                        top: `${(draft.startMinute / 60) * HOUR_PX}px`,
                        height: `${Math.max(((draft.endMinute - draft.startMinute) / 60) * HOUR_PX, MIN_SLOT_PX)}px`,
                      }}
                      className="pointer-events-none absolute inset-x-0.5 z-10 overflow-hidden rounded-md border border-dashed border-ink bg-paper px-1 text-xs text-ink"
                    >
                      <span className="block font-semibold">
                        {draft.title || "(Sin título)"}
                      </span>
                      <span className="block tabular-nums">
                        {fromMinutes(draft.startMinute)} –{" "}
                        {fromMinutes(draft.endMinute)}
                      </span>
                    </div>
                  ) : null}
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
                          // The color marks, the text stays in ink (spec 005 RF-4).
                          borderLeftColor: slot.event.color,
                        }}
                        className="absolute overflow-hidden rounded-md border-l-4 bg-stone px-1 text-xs text-ink ring-1 ring-paper"
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
        <p className="text-center text-muted">No hay eventos</p>
      ) : null}
    </div>
  );
}
