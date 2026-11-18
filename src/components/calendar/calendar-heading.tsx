"use client";

import { useCalendarHeader } from "@/components/shell/calendar-header";
import Link from "next/link";
import { ChevronIcon, FiltersIcon, SearchIcon } from "@/components/shell/icons";
import { formatDateKeyFull } from "@/lib/calendar/format";
import { navigate, type CalendarView } from "@/lib/calendar/ranges";
import { CAL_NEXT, CAL_PREV, CAL_VIEW } from "@/lib/calendar/transition-types";
import { CalendarLink, useCalendarGo } from "./calendar-nav";

const VIEWS: {
  view: CalendarView;
  label: string;
  previous: string;
  next: string;
}[] = [
  { view: "agenda", label: "Agenda", previous: "", next: "" },
  {
    view: "day",
    label: "Día",
    previous: "Día anterior",
    next: "Día siguiente",
  },
  {
    view: "week",
    label: "Semana",
    previous: "Semana anterior",
    next: "Semana siguiente",
  },
  {
    view: "month",
    label: "Mes",
    previous: "Mes anterior",
    next: "Mes siguiente",
  },
];

const ICON =
  "flex size-11 items-center justify-center rounded-control text-muted press-quiet hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink";

/**
 * The calendar's own controls on a phone, at the top of its content as in
 * every view of the Nexo identity (constitution, amendment 11; spec 030
 * RF-7, plan D5): the views as pill tabs, the calendars (filters) and
 * "Hoy ‹ ›". Swiping still changes period with one hand (spec 024).
 */
export function CalendarHeading({
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
  const go = useCalendarGo();
  const { state, openSheet } = useCalendarHeader();
  const current = VIEWS.find((item) => item.view === view)!;

  return (
    <nav
      aria-label="Calendario" // Stays under the header while the agenda scrolls.
      className="sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-20 -mx-4 flex flex-col gap-1 bg-stone px-4 pb-1 tab:hidden"
    >
      <ul
        aria-label="Vistas"
        className="flex gap-1 self-start rounded-full surface p-1"
      >
        {VIEWS.map((item) => (
          <li key={item.view}>
            <CalendarLink
              view={item.view}
              date={date}
              types={[CAL_VIEW]}
              aria-current={item.view === view ? "page" : undefined}
              // Fire and forget: failing to remember must not block it.
              onClick={() => void saveLastView?.(item.view)}
              className="flex min-h-10 items-center rounded-full px-3.5 text-sm font-medium text-muted press-quiet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-accent-gradient aria-[current=page]:text-on-accent"
            >
              {item.label}
            </CalendarLink>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => openSheet(event.currentTarget)}
          className="flex min-h-11 items-center gap-2 rounded-control pr-3 text-sm font-medium text-muted press-quiet hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <FiltersIcon />
          Calendarios
        </button>
        <div className="flex items-center">
          {/* Spec 039 RF-1: the search, also with "/" on a keyboard. */}
          <Link
            href="/dashboard/search"
            aria-label="Buscar"
            aria-keyshortcuts="/"
            className={ICON}
          >
            <SearchIcon />
          </Link>
          <button
            type="button"
            aria-label={`Hoy, ${formatDateKeyFull(today)}`}
            aria-keyshortcuts="T"
            disabled={!state?.onToday}
            onClick={() => state?.onToday?.()}
            className="flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-accent-ink press-quiet hover:bg-accent-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          >
            Hoy
          </button>
          {view === "agenda" ? null : (
            <>
              <button
                type="button"
                aria-label={current.previous}
                onClick={() => go(view, navigate(view, date, -1), [CAL_PREV])}
                className={ICON}
              >
                <ChevronIcon direction="left" />
              </button>
              <button
                type="button"
                aria-label={current.next}
                onClick={() => go(view, navigate(view, date, 1), [CAL_NEXT])}
                className={ICON}
              >
                <ChevronIcon direction="right" />
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
