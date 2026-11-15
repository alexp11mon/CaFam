"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useCalendarHeader } from "@/components/shell/calendar-header";
import { CaretIcon, ChevronIcon, FiltersIcon } from "@/components/shell/icons";
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

const BUTTON =
  "flex h-11 items-center justify-center rounded-control text-base font-semibold text-ink press-quiet hover:bg-stone focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink";

/**
 * The calendar's own bar on a phone, right above the bottom bar, where the
 * thumb is (spec 026 RF-1..RF-4, plan D1, D2): the view, "‹ Hoy ›" and the
 * calendars. Everything done many times a day, and nothing over the events.
 */
export function CalendarDock({
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
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // The assistant's button and the toasts go above this bar while it is on
  // screen. An effect and not :has(): Activity keeps a hidden calendar in the
  // DOM and runs this cleanup (plan D4).
  useEffect(() => {
    const frame = document.querySelector("[data-app-frame]");
    frame?.setAttribute("data-has-dock", "");
    return () => frame?.removeAttribute("data-has-dock");
  }, []);

  // The list of views closes on a tap outside and with Escape (RF-2).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!picker.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <nav
      aria-label="Calendario"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex h-13 items-center justify-between gap-2 border-t border-line bg-paper px-2 tab:hidden"
    >
      <div ref={picker} className="relative">
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`Vista: ${current.label}`}
          onClick={() => setOpen((shown) => !shown)}
          className={`${BUTTON} min-w-24 gap-1 border border-control px-3`}
        >
          {current.label}
          <CaretIcon open={open} />
        </button>
        <ul
          id={menuId}
          aria-label="Vistas"
          hidden={!open}
          className="pop absolute bottom-full left-0 mb-2 flex w-40 flex-col gap-1 rounded-control surface-float p-1 [--pop-origin:bottom_left]"
        >
          {VIEWS.map((item) => (
            <li key={item.view}>
              <CalendarLink
                view={item.view}
                date={date}
                types={[CAL_VIEW]}
                aria-current={item.view === view ? "page" : undefined}
                onClick={() => {
                  setOpen(false);
                  // Fire and forget: failing to remember must not block it.
                  void saveLastView?.(item.view);
                }}
                className="flex min-h-11 items-center rounded-block px-3 text-base font-medium text-ink press-quiet hover:bg-stone focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-accent/15 aria-[current=page]:font-semibold aria-[current=page]:text-accent-ink"
              >
                {item.label}
              </CalendarLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-1">
        {view === "agenda" ? null : (
          <button
            type="button"
            aria-label={current.previous}
            onClick={() => go(view, navigate(view, date, -1), [CAL_PREV])}
            className={`${BUTTON} w-11`}
          >
            <ChevronIcon direction="left" />
          </button>
        )}
        <button
          type="button"
          aria-label={`Hoy, ${formatDateKeyFull(today)}`}
          aria-keyshortcuts="T"
          disabled={!state?.onToday}
          onClick={() => state?.onToday?.()}
          className={`${BUTTON} border border-control px-4`}
        >
          Hoy
        </button>
        {view === "agenda" ? null : (
          <button
            type="button"
            aria-label={current.next}
            onClick={() => go(view, navigate(view, date, 1), [CAL_NEXT])}
            className={`${BUTTON} w-11`}
          >
            <ChevronIcon direction="right" />
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label="Calendarios"
        aria-haspopup="dialog"
        onClick={(event) => openSheet(event.currentTarget)}
        className={`${BUTTON} w-11`}
      >
        <FiltersIcon />
      </button>
    </nav>
  );
}
