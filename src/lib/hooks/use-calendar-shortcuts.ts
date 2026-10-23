"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  calendarHref,
  navigate,
  type CalendarView,
} from "@/lib/calendar/ranges";
import { shortcutFor } from "@/lib/calendar/shortcuts";

/**
 * N, T, the arrows and A/M/S/D on the calendar page (spec 008 RF-31, RF-46).
 * A new view is also remembered in the account (RF-25).
 */
export function useCalendarShortcuts({
  view,
  date,
  today,
  canCreate,
  saveLastView,
}: {
  view: CalendarView;
  date: string;
  today: string;
  canCreate: boolean;
  saveLastView?: (view: CalendarView) => Promise<{ error?: string }>;
}) {
  const router = useRouter();

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
      if (shortcut === "new") {
        router.push(`/dashboard/events/new?date=${date}`);
      } else if (shortcut === "today") {
        router.push(calendarHref(view, today));
      } else if (shortcut === "previous" || shortcut === "next") {
        router.push(
          calendarHref(
            view,
            navigate(view, date, shortcut === "next" ? 1 : -1),
          ),
        );
      } else {
        void saveLastView?.(shortcut);
        router.push(calendarHref(shortcut, date));
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [view, date, today, canCreate, saveLastView, router]);
}
