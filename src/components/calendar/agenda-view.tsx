"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { buildAgenda, type AgendaDay } from "@/lib/calendar/agenda";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { formatTime } from "@/lib/calendar/time-zone";
import { calendarHref } from "@/lib/calendar/ranges";
import { useNow } from "@/lib/hooks/use-now";
import { PlusIcon } from "@/components/shell/icons";
import { EventRow } from "./event-row";

export type { AgendaEvent } from "@/lib/calendar/to-view-events";
import type { AgendaEvent } from "@/lib/calendar/to-view-events";

function NowLine({ now, timeZone }: { now: number; timeZone: string }) {
  return (
    <li
      data-now-line=""
      className="flex scroll-mt-24 items-center gap-2 py-1 text-sm font-semibold text-accent-ink tabular-nums"
    >
      <span className="sr-only">Hora actual</span>
      <span aria-hidden="true" className="size-2 rounded-full bg-accent-ink" />
      {formatTime(now, timeZone)}
      <span
        aria-hidden="true"
        className="h-0.5 flex-1 rounded-full bg-accent-ink"
      />
    </li>
  );
}

function AgendaDaySection({
  day,
  now,
  timeZone,
  canCreate,
}: {
  day: AgendaDay<AgendaEvent>;
  now: number | null;
  timeZone: string;
  canCreate: boolean;
}) {
  const headingId = `agenda-${day.key}`;
  const rows = day.entries.map((entry) => (
    <li key={entry.event.id}>
      <EventRow entry={entry} />
    </li>
  ));
  if (day.nowIndex !== null && now !== null) {
    rows.splice(
      day.nowIndex,
      0,
      <NowLine key="now" now={now} timeZone={timeZone} />,
    );
  }

  return (
    <section
      data-today={day.isToday ? "" : undefined}
      aria-labelledby={headingId}
      className="grid gap-3 border-t border-line pt-4 pb-8 first:border-t-2 first:border-ink sm:grid-cols-[11rem_1fr] sm:gap-6 lg:grid-cols-[13rem_1fr]"
    >
      <div className="flex items-start justify-between gap-3 sm:flex-col sm:justify-start">
        <h2 id={headingId} className="flex items-start gap-2">
          <span className="sr-only">
            {day.isToday ? `${day.label}, hoy` : day.label}
          </span>
          {/* The big number is the signature of the agenda (constitution, spec 005 RF-32). */}
          <span
            aria-hidden="true"
            className="text-[clamp(4rem,14vw,7rem)] leading-[0.82] font-extrabold tracking-[-0.06em] text-ink tabular-nums"
          >
            {day.number}
          </span>
          <span
            aria-hidden="true"
            className="flex flex-col items-start gap-1 pt-1"
          >
            <span className="text-lg font-bold text-accent-ink first-letter:uppercase">
              {day.weekday}
            </span>
            {day.isToday ? (
              <span className="rounded-full border border-accent-edge bg-accent px-2 py-0.5 text-xs font-bold text-on-accent">
                Hoy
              </span>
            ) : null}
          </span>
        </h2>
        {canCreate ? (
          <Link
            href={`/dashboard/events/new?date=${day.key}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-control text-ink transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <PlusIcon />
            <span className="sr-only">Crear evento el {day.label}</span>
          </Link>
        ) : null}
      </div>
      {day.entries.length > 0 ? (
        <ul className="flex min-w-0 flex-col gap-2">{rows}</ul>
      ) : (
        <p className="flex min-h-16 items-center rounded-2xl border border-dashed border-control px-4 text-muted">
          Sin eventos
        </p>
      )}
    </section>
  );
}

/** 14 days in a row with the big day numbers of the reference (spec 005 RF-30..RF-42). */
export function AgendaView({
  days,
  events,
  timeZone,
  today,
  canCreate,
}: {
  days: string[];
  events: AgendaEvent[];
  timeZone: string;
  today: string;
  canCreate: boolean;
}) {
  const now = useNow();
  const list = useRef<HTMLDivElement>(null);

  function scrollToNow() {
    // A day without events has no line: then the day itself.
    const target =
      list.current?.querySelector("[data-now-line]") ??
      list.current?.querySelector("[data-today]");
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // Arriving from "Hora actual" on another period (spec 008 RF-24).
  useEffect(() => {
    if (window.location.hash === "#ahora" && now !== null) scrollToNow();
  }, [now]);

  const agenda = buildAgenda({
    days,
    events,
    timeZone,
    today,
    now: now === null ? undefined : new Date(now),
  });

  // A sticky control, so it is there wherever the agenda is scrolled (spec 008 RF-23).
  const NOW_BUTTON =
    "sticky top-2 z-10 inline-flex min-h-11 items-center justify-center self-end rounded-full border border-control bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

  return (
    <div ref={list} className="flex flex-col">
      {days.includes(today) ? (
        <button type="button" onClick={scrollToNow} className={NOW_BUTTON}>
          Hora actual
        </button>
      ) : (
        <Link
          href={`${calendarHref("agenda", today)}#ahora`}
          className={NOW_BUTTON}
        >
          Hora actual
        </Link>
      )}
      {agenda.map((day) => (
        <AgendaDaySection
          key={day.key}
          day={day}
          now={now}
          timeZone={timeZone}
          canCreate={canCreate}
        />
      ))}
    </div>
  );
}
