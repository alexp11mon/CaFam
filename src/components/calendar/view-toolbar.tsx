"use client";

import { WeekendToggle } from "./weekend-toggle";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { CaretIcon, ChevronIcon, MenuIcon } from "@/components/shell/icons";
import {
  setSidebarCollapsed,
  setSidebarPicker,
  useSidebar,
} from "@/lib/hooks/use-sidebar-collapsed";
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
  showWeekends = true,
}: {
  view: CalendarView;
  date: string;
  today: string;
  /** Hidden weekends offer a way back here (spec 019 RF-28). */
  showWeekends?: boolean;
  /** Remembers the chosen view in the account (spec 008 RF-25). */
  saveLastView?: (view: CalendarView) => Promise<{ error?: string }>;
}) {
  const current = VIEWS.find((item) => item.view === view)!;
  const sidebar = useSidebar();

  return (
    <nav aria-label="Navegación del calendario" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Folds the side panel, from 1024 px where it is a column (spec 019 RF-17, RF-22). */}
        <button
          type="button"
          aria-expanded={!sidebar.collapsed}
          aria-controls="calendar-side-panel"
          aria-label={
            sidebar.collapsed ? "Desplegar el panel" : "Plegar el panel"
          }
          onClick={() => setSidebarCollapsed(!sidebar.collapsed)}
          className={`${BUTTON} hidden px-0 lg:inline-flex`}
        >
          <MenuIcon />
        </button>
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
            <h2 className="min-w-0 text-lg font-bold text-ink tabular-nums first-letter:uppercase">
              {formatPeriodTitle(view, date)}
            </h2>
            {/* Folded, the mini month opens from the title (RF-19). */}
            {sidebar.collapsed ? (
              <button
                type="button"
                aria-label="Elegir fecha"
                aria-expanded={sidebar.pickerOpen}
                aria-controls="calendar-date-picker"
                onClick={() => setSidebarPicker(!sidebar.pickerOpen)}
                className="hidden size-11 items-center justify-center rounded-full text-ink press hover:bg-stone focus-visible:outline-2 focus-visible:outline-ink lg:inline-flex"
              >
                <CaretIcon open={sidebar.pickerOpen} />
              </button>
            ) : null}
            <span className="flex-1" />
          </>
        )}
      </div>
      <div className="flex gap-1 self-start rounded-full bg-paper p-1 max-sm:self-stretch">
        <ViewSwitcher view={view} date={date} saveLastView={saveLastView} />
        {showWeekends ? null : (
          <WeekendToggle className={`${BUTTON} border-0 bg-transparent`} />
        )}
      </div>
    </nav>
  );
}

const VIEW_ITEM =
  "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-base font-semibold sm:flex-none";

/**
 * The views, drawn twice in the same box: muted text below and, above it, an
 * accent layer clipped to the chosen view. Moving the clip slides the pill and
 * turns the text white exactly where it passes (spec 021 RF-34, RF-35, D8).
 */
function ViewSwitcher({
  view,
  date,
  saveLastView,
}: {
  view: CalendarView;
  date: string;
  saveLastView?: (view: CalendarView) => Promise<{ error?: string }>;
}) {
  const group = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = group.current;
    const clip = layer.current;
    if (!box || !clip) return;
    const measure = () => {
      const chosen = box.querySelector('[aria-current="page"]');
      if (!chosen) return;
      const outer = box.getBoundingClientRect();
      const inner = chosen.getBoundingClientRect();
      clip.style.setProperty("--l", `${inner.left - outer.left}px`);
      clip.style.setProperty("--r", `${outer.right - inner.right}px`);
      clip.dataset.ready = "";
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [view]);

  return (
    // Its own view-transition name, so the view's cross-fade does not show
    // it twice (plan R1).
    <div
      ref={group}
      className="relative flex flex-1 gap-1 [view-transition-name:view-switcher] sm:flex-none"
    >
      {VIEWS.map((item) => (
        <Link
          key={item.view}
          href={calendarHref(item.view, date)}
          transitionTypes={[CAL_VIEW]}
          aria-current={item.view === view ? "page" : undefined}
          aria-keyshortcuts={item.key}
          // Fire and forget: failing to remember the view must not block it.
          onClick={() => void saveLastView?.(item.view)}
          // The chosen view is a selection: the accent layer above paints it
          // (constitution, RF-3).
          className={`${VIEW_ITEM} press-quiet text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
        >
          {item.label}
          {/* The key, as Google shows it in its view menu; only with a keyboard-sized screen. */}
          <kbd
            aria-hidden="true"
            className="ml-2 hidden font-sans text-xs font-semibold text-muted lg:inline"
          >
            {item.key}
          </kbd>
        </Link>
      ))}
      {/* The edge, then the accent 1 px inside it: the pill of a selection. */}
      <div
        ref={layer}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-accent-edge opacity-0 transition-[clip-path] duration-(--motion-move) ease-(--ease-in-out) [clip-path:inset(0_var(--r)_0_var(--l)_round_9999px)] data-ready:opacity-100"
      >
        <div className="absolute inset-0 flex gap-1 bg-accent text-on-accent transition-[clip-path] duration-(--motion-move) ease-(--ease-in-out) [clip-path:inset(1px_calc(var(--r)+1px)_1px_calc(var(--l)+1px)_round_9999px)]">
          {VIEWS.map((item) => (
            <span key={item.view} className={VIEW_ITEM}>
              {item.label}
              <kbd className="ml-2 hidden font-sans text-xs font-semibold text-on-accent/70 lg:inline">
                {item.key}
              </kbd>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
