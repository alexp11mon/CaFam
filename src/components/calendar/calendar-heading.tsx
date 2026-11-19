"use client";

import { useCalendarHeader } from "@/components/shell/calendar-header";
import Link from "next/link";
import { useId, useState } from "react";
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
    view: "month",
    label: "Mes",
    previous: "Mes anterior",
    next: "Mes siguiente",
  },
  {
    view: "week",
    label: "Semana",
    previous: "Semana anterior",
    next: "Semana siguiente",
  },
  {
    view: "day",
    label: "Día",
    previous: "Día anterior",
    next: "Día siguiente",
  },
];

/** Behind "Más vistas": six tabs do not fit at 390 px (spec 042 RF-10, plan D3). */
const MORE_VIEWS: typeof VIEWS = [
  {
    view: "year",
    label: "Año",
    previous: "Año anterior",
    next: "Año siguiente",
  },
  {
    view: "4days",
    label: "4 días",
    previous: "4 días anteriores",
    next: "4 días siguientes",
  },
];

const TAB =
  "flex min-h-10 items-center whitespace-nowrap rounded-full px-3 text-sm font-medium text-muted press-quiet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-accent-gradient aria-[current=page]:text-on-accent";

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
  const current = [...VIEWS, ...MORE_VIEWS].find((item) => item.view === view)!;
  const more = MORE_VIEWS.find((item) => item.view === view);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();

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
              className={TAB}
            >
              {item.label}
            </CalendarLink>
          </li>
        ))}
        <li
          className="relative"
          onKeyDown={(event) => {
            if (event.key === "Escape" && moreOpen) {
              event.stopPropagation();
              setMoreOpen(false);
            }
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setMoreOpen(false);
            }
          }}
        >
          <button
            type="button"
            aria-label={more ? `Más vistas: ${more.label}` : "Más vistas"}
            aria-expanded={moreOpen}
            aria-controls={moreId}
            aria-current={more ? "page" : undefined}
            onClick={() => setMoreOpen((open) => !open)}
            className={`${TAB} gap-1`}
          >
            {more?.label ?? "Más"}
            <ChevronIcon direction={moreOpen ? "up" : "down"} />
          </button>
          {moreOpen ? (
            <ul
              id={moreId}
              className="pop absolute right-0 top-full z-30 mt-1 flex min-w-36 flex-col gap-1 rounded-card surface-float bg-paper p-1 [--pop-origin:top_right]"
            >
              {MORE_VIEWS.map((item) => (
                <li key={item.view}>
                  <CalendarLink
                    view={item.view}
                    date={date}
                    types={[CAL_VIEW]}
                    aria-current={item.view === view ? "page" : undefined}
                    onClick={() => {
                      setMoreOpen(false);
                      void saveLastView?.(item.view);
                    }}
                    className={`${TAB} min-h-11 w-full`}
                  >
                    {item.label}
                  </CalendarLink>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
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
