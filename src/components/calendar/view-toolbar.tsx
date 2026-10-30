"use client";

import Link from "next/link";
import { ChevronIcon } from "@/components/shell/icons";
import { requestAgendaToday } from "@/lib/calendar/agenda-today";
import { formatPeriodTitle } from "@/lib/calendar/format";
import {
  calendarHref,
  navigate,
  type CalendarView,
} from "@/lib/calendar/ranges";
import {
  CAL_NEXT,
  CAL_PREV,
  CAL_VIEW,
  todayType,
  typesOf,
} from "@/lib/calendar/transition-types";

const VIEWS: {
  view: CalendarView;
  label: string;
  /** Shortcut key (spec 008 RF-46). */
  key: string;
  previous: string;
  next: string;
}[] = [
  {
    view: "agenda",
    label: "Agenda",
    key: "A",
    previous: "14 días anteriores",
    next: "14 días siguientes",
  },
  {
    view: "month",
    label: "Mes",
    key: "M",
    previous: "Mes anterior",
    next: "Mes siguiente",
  },
  {
    view: "week",
    label: "Semana",
    key: "S",
    previous: "Semana anterior",
    next: "Semana siguiente",
  },
  {
    view: "day",
    label: "Día",
    key: "D",
    previous: "Día anterior",
    next: "Día siguiente",
  },
];

const BUTTON =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-control bg-paper px-4 text-base font-semibold text-ink press hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** View switcher, previous / next / today and the period heading (RF-29, RF-37). */
export function ViewToolbar({
  view,
  date,
  today,
  saveLastView,
}: {
  view: CalendarView;
  date: string;
  today: string;
  /** Remembers the chosen view in the account (spec 008 RF-25). */
  saveLastView?: (view: CalendarView) => Promise<{ error?: string }>;
}) {
  const current = VIEWS.find((item) => item.view === view)!;

  return (
    <nav aria-label="Navegación del calendario" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {view === "agenda" ? (
          // The agenda is one continuous list: "Hoy" scrolls it, no previous or next (spec 016 RF-47, RF-58).
          <button
            type="button"
            onClick={requestAgendaToday}
            aria-keyshortcuts="T"
            className={BUTTON}
          >
            Hoy
          </button>
        ) : (
          <>
            <Link
              href={calendarHref(view, today)}
              transitionTypes={typesOf(todayType(date, today))}
              aria-keyshortcuts="T"
              className={BUTTON}
            >
              Hoy
            </Link>
            <Link
              href={calendarHref(view, navigate(view, date, -1))}
              transitionTypes={[CAL_PREV]}
              aria-label={current.previous}
              aria-keyshortcuts="ArrowLeft"
              className={BUTTON}
            >
              <ChevronIcon direction="left" />
            </Link>
            <Link
              href={calendarHref(view, navigate(view, date, 1))}
              transitionTypes={[CAL_NEXT]}
              aria-label={current.next}
              aria-keyshortcuts="ArrowRight"
              className={BUTTON}
            >
              <ChevronIcon direction="right" />
            </Link>
            <h2 className="min-w-0 flex-1 text-lg font-bold text-ink tabular-nums first-letter:uppercase">
              {formatPeriodTitle(view, date)}
            </h2>
          </>
        )}
      </div>
      <div className="flex gap-1 self-start rounded-full bg-paper p-1 max-sm:self-stretch">
        {VIEWS.map((item) => (
          <Link
            key={item.view}
            href={calendarHref(item.view, date)}
            transitionTypes={[CAL_VIEW]}
            aria-current={item.view === view ? "page" : undefined}
            aria-keyshortcuts={item.key}
            // Fire and forget: failing to remember the view must not block it.
            onClick={() => void saveLastView?.(item.view)}
            // The chosen view is a selection, so it takes the accent (constitution, RF-3).
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-base font-semibold press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:flex-none ${item.view === view ? "border border-accent-edge bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
          >
            {item.label}
            {/* The key, as Google shows it in its view menu; only with a keyboard-sized screen. */}
            <kbd
              aria-hidden="true"
              className={`ml-2 hidden font-sans text-xs font-semibold lg:inline ${item.view === view ? "text-on-accent/70" : "text-muted"}`}
            >
              {item.key}
            </kbd>
          </Link>
        ))}
      </div>
    </nav>
  );
}
