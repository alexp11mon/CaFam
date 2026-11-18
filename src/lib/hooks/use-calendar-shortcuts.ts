"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCalendarGo } from "@/components/calendar/calendar-nav";
import { navigate, type CalendarView } from "@/lib/calendar/ranges";
import { requestAgendaToday } from "@/lib/calendar/agenda-today";
import { shortcutFor } from "@/lib/calendar/shortcuts";
import {
  CAL_VIEW,
  periodType,
  todayType,
  typesOf,
} from "@/lib/calendar/transition-types";

/**
 * N, T, the arrows and A/M/S/D on the calendar page (spec 008 RF-31, RF-46).
 * A new view is also remembered in the account (RF-25). Each move carries
 * its transition type, like the toolbar (spec 011 RF-17, RF-18).
 */
export function useCalendarShortcuts({
  view,
  date,
  today,
  canCreate,
  saveLastView,
  onGoTo,
  onHelp,
}: {
  view: CalendarView;
  date: string;
  today: string;
  canCreate: boolean;
  saveLastView?: (view: CalendarView) => Promise<{ error?: string }>;
  /** G and ?: their dialogs (spec 017 RF-56, RF-62). */
  onGoTo?: () => void;
  onHelp?: () => void;
}) {
  const router = useRouter();
  const go = useCalendarGo();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut = shortcutFor(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          target: event.target,
          dialogOpen: document.querySelector("dialog[open]") !== null,
        },
        canCreate,
      );
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut === "goto") {
        onGoTo?.();
      } else if (shortcut === "help") {
        onHelp?.();
      } else if (shortcut === "search") {
        router.push("/dashboard/search");
      } else if (shortcut === "new") {
        router.push(`/dashboard/events/new?date=${date}`);
      } else if (shortcut === "today" && view === "agenda") {
        // The continuous agenda scrolls instead (spec 016 RF-58).
        requestAgendaToday();
      } else if (shortcut === "today") {
        go(view, today, typesOf(todayType(date, today)));
      } else if (shortcut === "previous" || shortcut === "next") {
        const delta = shortcut === "next" ? 1 : -1;
        go(view, navigate(view, date, delta), typesOf(periodType(delta)));
      } else {
        void saveLastView?.(shortcut);
        go(shortcut, date, [CAL_VIEW]);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [view, date, today, canCreate, saveLastView, onGoTo, onHelp, router, go]);
}
