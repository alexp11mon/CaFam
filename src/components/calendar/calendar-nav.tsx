"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  type ComponentProps,
} from "react";
import { calendarHref, type CalendarView } from "@/lib/calendar/ranges";

/** Moves the calendar to a view and a date; `types` name the transition. */
export type CalendarGo = (
  view: CalendarView,
  date: string,
  types?: string[],
) => void;

/**
 * Set by the calendar screen (spec 024 RF-2, plan D2): inside it a change of
 * view or period happens in the browser, with no request.
 */
export const CalendarNavContext = createContext<CalendarGo | null>(null);

/** `go` of the calendar screen, or a normal navigation outside it. */
export function useCalendarGo(): CalendarGo {
  const go = useContext(CalendarNavContext);
  const router = useRouter();
  const fallback = useCallback<CalendarGo>(
    (view, date, types) =>
      router.push(calendarHref(view, date), { transitionTypes: types }),
    [router],
  );
  return go ?? fallback;
}

/**
 * A link to a view and date of the calendar (RF-7, plan D6). It keeps its
 * address (open in a new tab, copy, screen readers) but never prefetches:
 * each day of a month was one request. Inside the calendar a plain click
 * moves in the browser.
 */
export function CalendarLink({
  view,
  date,
  types,
  onClick,
  ...rest
}: {
  view: CalendarView;
  date: string;
  types?: string[];
} & Omit<ComponentProps<"a">, "href">) {
  const go = useContext(CalendarNavContext);
  const href = calendarHref(view, date);
  if (!go) {
    return (
      <Link
        href={href}
        prefetch={false}
        transitionTypes={types}
        onClick={onClick}
        {...rest}
      />
    );
  }
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        go(view, date, types);
      }}
      {...rest}
    />
  );
}
