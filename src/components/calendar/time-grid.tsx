"use client";

import Link from "next/link";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  moveDraft,
  resizeDraft,
  type DraftRange,
} from "@/lib/calendar/draft-drag";
import { formatDateKeyFull } from "@/lib/calendar/format";
import {
  dayEvents,
  isBanner,
  layoutTimedDay,
  type CalendarEventItem,
} from "@/lib/calendar/layout";
import { layoutMonthWeek } from "@/lib/calendar/month-lanes";
import type { Box } from "@/lib/calendar/popover";
import { calendarHref } from "@/lib/calendar/ranges";
import type { MinuteRange } from "@/lib/calendar/slots";
import { fromMinutes } from "@/lib/calendar/time-options";
import {
  utcToZonedParts,
  weekdayIndex,
  zonedDateKey,
} from "@/lib/calendar/time-zone";
import { useGridZoom } from "@/lib/hooks/use-grid-zoom";
import { useIsPhone } from "@/lib/hooks/use-is-phone";
import { useNow } from "@/lib/hooks/use-now";
import { BusyBlock, isBusyItem, type BusyGridItem } from "./busy-block";
import { DraggableEvent } from "./draggable-event";
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

const MIN_SLOT_PX = 22;
const FIRST_VISIBLE_HOUR = 7;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const INITIALS = ["L", "M", "X", "J", "V", "S", "D"];

const percent = (value: number) => `${Number(value.toFixed(4))}%`;

function minuteOfDay(instant: number, timeZone: string) {
  const { hour, minute } = utcToZonedParts(instant, timeZone);
  return hour * 60 + minute;
}

/**
 * Hour grid shared by the week and day views, as Google: a fixed header with
 * the initial and a big number, a strip of one-line blocks for all-day and
 * multi-day events, filled blocks side by side and the now line (spec 016
 * RF-38..RF-46). Creating on a slot is kept (spec 008 RF-20, RF-36).
 */
export function TimeGrid({
  days,
  events,
  timeZone,
  today,
  linkDays,
  onCreate,
  draft,
  duration,
  onDraftChange,
  busy = [],
}: {
  /** Other people's busy times, beside the events (spec 020 RF-8, RF-11). */
  busy?: BusyGridItem[];
  /** The provisional block moved or stretched on a phone (spec 019 RF-35 to RF-38). */
  onDraftChange?: (range: DraftRange) => void;
  /** The account's length of a new event (spec 019 RF-32). */
  duration?: number;
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
  const now = useNow();
  const root = useRef<HTMLDivElement>(null);
  // Pinch or Ctrl + wheel change it, remembered on this device (spec 017 RF-49 to RF-53).
  const hourPx = useGridZoom(root);
  const columns = {
    gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))`,
  };
  const items = [...events, ...busy];
  const banners = layoutMonthWeek(
    items.filter((event) => isBanner(event, timeZone)),
    days,
    timeZone,
  );
  const isEmpty = days.every(
    (day) => dayEvents(events, day, timeZone).length === 0,
  );
  const showsToday = days.includes(today);

  return (
    // The screen height under the header, never under 28 rem on a larger screen.
    <div
      ref={root}
      className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-top))] flex-col gap-3 tab:h-[max(32rem,calc(100dvh-14rem))]"
    >
      {/* The grid scrolls on its own; the day header and the strip stay on top (RF-38). */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-paper max-tab:-mx-4 max-tab:rounded-none">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid border-b border-line" style={columns}>
            <div />
            {days.map((day) => {
              const isToday = day === today;
              const number = `inline-flex size-10 items-center justify-center rounded-full text-2xl font-semibold tabular-nums ${isToday ? "border border-accent-edge bg-accent text-on-accent" : "text-ink"}`;
              return (
                <div
                  key={day}
                  data-testid="day-header"
                  className="flex flex-col items-center py-1"
                >
                  <span
                    className={`text-xs font-semibold ${isToday ? "text-accent-ink" : "text-muted"}`}
                  >
                    {INITIALS[weekdayIndex(day)]}
                  </span>
                  {linkDays ? (
                    <Link
                      href={calendarHref("day", day)}
                      aria-label={formatDateKeyFull(day)}
                      aria-current={isToday ? "date" : undefined}
                      className={`${number} focus-visible:outline-2 focus-visible:outline-ink`}
                    >
                      {Number(day.slice(8))}
                    </Link>
                  ) : (
                    <span
                      aria-label={formatDateKeyFull(day)}
                      aria-current={isToday ? "date" : undefined}
                      className={number}
                    >
                      {Number(day.slice(8))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* One block per event across its days, in lanes as the month (RF-40).
              Always there, as Google: showing it only while dragging would push
              the grid down under the pointer (spec 017 RF-13). */}
          <div
            data-testid="banner-strip"
            className="grid min-h-6 gap-y-0.5 border-b border-line py-0.5"
            style={columns}
          >
            <span className="sr-only">Todo el día</span>
            {days.map((day, index) => (
              // Behind the blocks: where an event lands on the strip (plan D3).
              <div
                key={day}
                data-allday-day={day}
                aria-hidden="true"
                style={{
                  gridColumn: index + 2,
                  gridRow: `1 / span ${Math.max(1, ...banners.map((b) => b.lane + 1))}`,
                }}
              />
            ))}
            {banners.map(({ event, start, span, lane }) =>
              isBusyItem(event) ? (
                <BusyBlock
                  key={event.id}
                  item={event}
                  hours={null}
                  className="relative mx-0.5 h-5 min-w-0"
                  style={{
                    gridColumn: `${start + 2} / span ${span}`,
                    gridRow: lane + 1,
                  }}
                />
              ) : (
                <DraggableEvent
                  key={event.id}
                  mode="strip"
                  event={event}
                  timeZone={timeZone}
                  shape="line"
                  className="mx-0.5 min-w-0"
                  style={{
                    gridColumn: `${start + 2} / span ${span}`,
                    gridRow: lane + 1,
                  }}
                />
              ),
            )}
          </div>
          <ScrollOnMount
            scrollKey={`${days[0]}|${showsToday}`}
            // The current hour less one with today in view, else the morning (RF-45).
            top={() =>
              showsToday
                ? Math.max(0, minuteOfDay(Date.now(), timeZone) / 60 - 1) *
                  hourPx
                : FIRST_VISIBLE_HOUR * hourPx
            }
            // Two fingers zoom the hours, never the page (plan R2).
            className="min-h-0 flex-1 touch-pan-x touch-pan-y overflow-y-auto"
          >
            <div data-testid="time-grid" className="grid" style={columns}>
              <div>
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{ height: hourPx }}
                    className="pr-1 text-right text-[11px] text-muted tabular-nums"
                  >
                    {/* "9:00" on its line, as Google; midnight has no label (RF-44). */}
                    {hour > 0 ? (
                      <span className="block -translate-y-1/2">{hour}:00</span>
                    ) : null}
                  </div>
                ))}
              </div>
              {days.map((day) => (
                <div
                  key={day}
                  data-day={day}
                  data-time-col=""
                  className="relative border-l border-line"
                  style={{ height: 24 * hourPx }}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      aria-hidden="true"
                      style={{ height: hourPx }}
                      className="border-t border-line"
                    />
                  ))}
                  {onCreate ? (
                    <SlotLayer
                      day={day}
                      dayLabel={formatDateKeyFull(day)}
                      onCreate={onCreate}
                      duration={duration}
                    />
                  ) : null}
                  {draft?.day === day ? (
                    <DraftBlock
                      draft={draft}
                      hourPx={hourPx}
                      onChange={onDraftChange}
                    />
                  ) : null}
                  {layoutTimedDay(items, day, timeZone).map((slot) => {
                    const width = 100 / slot.columns;
                    const place = {
                      top: `${(slot.startMinute / 60) * hourPx}px`,
                      height: `${Math.max(((slot.endMinute - slot.startMinute) / 60) * hourPx, MIN_SLOT_PX)}px`,
                      left: percent(slot.column * width),
                      width: percent(width),
                    };
                    if (isBusyItem(slot.event)) {
                      return (
                        <BusyBlock
                          key={slot.event.id}
                          item={slot.event}
                          hours={`${fromMinutes(slot.startMinute)} – ${fromMinutes(slot.endMinute)}`}
                          className="absolute border border-paper"
                          style={place}
                        />
                      );
                    }
                    return (
                      <DraggableEvent
                        key={slot.event.id}
                        mode="grid"
                        // Only within one day: an overnight event is never resized (spec 017 cases).
                        resizable={
                          zonedDateKey(slot.event.startsAt, timeZone) === day &&
                          zonedDateKey(
                            Date.parse(slot.event.endsAt) - 1,
                            timeZone,
                          ) === day
                        }
                        event={slot.event}
                        timeZone={timeZone}
                        shape="grid"
                        // A block under 30 min has no room for it (spec 012 RF-12).
                        icons={slot.endMinute - slot.startMinute >= 30}
                        // A paper edge parts blocks that touch, as Google.
                        className="absolute border border-paper"
                        style={place}
                      />
                    );
                  })}
                  {day === today && now !== null ? (
                    // The current time: a line with a dot at its start (RF-43).
                    <div
                      data-testid="now-line"
                      aria-hidden="true"
                      style={{
                        top: `${(minuteOfDay(now, timeZone) / 60) * hourPx}px`,
                      }}
                      className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-accent-ink"
                    >
                      <span
                        data-now-dot=""
                        className="absolute -top-[5px] -left-1.5 size-3 rounded-full bg-accent-ink"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollOnMount>
        </div>
      </div>
      {isEmpty ? <p className="sr-only">No hay eventos</p> : null}
    </div>
  );
}

/**
 * The event being created (spec 008 RF-40). On a phone it moves with the
 * finger and stretches from its handle in quarters (spec 019 RF-35 to RF-38);
 * the quick window shows the same hours (RF-39).
 */
function DraftBlock({
  draft,
  hourPx,
  onChange,
}: {
  draft: GridDraft;
  hourPx: number;
  onChange?: (range: DraftRange) => void;
}) {
  const phone = useIsPhone();
  const drag = useRef<{
    kind: "move" | "resize";
    y: number;
    range: DraftRange;
  } | null>(null);
  const editable = phone && onChange !== undefined;

  function grab(
    kind: "move" | "resize",
    pointer: ReactPointerEvent<HTMLElement>,
  ) {
    if (!editable) return;
    pointer.stopPropagation();
    pointer.currentTarget.setPointerCapture?.(pointer.pointerId);
    drag.current = {
      kind,
      y: pointer.clientY,
      range: { startMinute: draft.startMinute, endMinute: draft.endMinute },
    };
  }

  function move(pointer: ReactPointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || !onChange) return;
    const minutes = ((pointer.clientY - current.y) / hourPx) * 60;
    onChange(
      current.kind === "move"
        ? moveDraft(current.range, minutes)
        : resizeDraft(current.range, current.range.endMinute + minutes),
    );
  }

  const release = () => {
    drag.current = null;
  };

  return (
    <div
      data-testid="draft-block"
      aria-hidden="true"
      data-draft-block=""
      onPointerDown={(pointer) => grab("move", pointer)}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      style={{
        top: `${(draft.startMinute / 60) * hourPx}px`,
        height: `${Math.max(((draft.endMinute - draft.startMinute) / 60) * hourPx, MIN_SLOT_PX)}px`,
      }}
      className={`absolute inset-x-0.5 z-10 overflow-hidden rounded-md border border-dashed border-ink bg-paper px-1 text-xs text-ink ${editable ? "touch-none select-none" : "pointer-events-none"}`}
    >
      <span className="block font-semibold">
        {draft.title || "(Sin título)"}
      </span>
      <span className="block tabular-nums">
        {fromMinutes(draft.startMinute)} – {fromMinutes(draft.endMinute)}
      </span>
      {editable ? (
        // The handle is bigger than it looks, for a finger (RF-35).
        <span
          data-testid="draft-handle"
          onPointerDown={(pointer) => grab("resize", pointer)}
          className="absolute inset-x-0 -bottom-1 flex h-6 items-end justify-center pb-1.5"
        >
          <span className="h-1 w-8 rounded-full bg-ink" />
        </span>
      ) : null}
    </div>
  );
}
