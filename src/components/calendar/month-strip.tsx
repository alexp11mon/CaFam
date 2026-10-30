"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { monthStrip } from "@/lib/calendar/month-strip";
import { calendarHref } from "@/lib/calendar/ranges";

/**
 * Row of months under the phone header in the month view, with the visible
 * one marked as the selection (spec 016 RF-20..RF-22).
 */
export function MonthStrip({ month }: { month: string }) {
  const row = useRef<HTMLUListElement>(null);

  // Centre the visible month; only the row moves, never the page (scrollIntoView would).
  useEffect(() => {
    const list = row.current;
    const current = list?.querySelector<HTMLElement>("[aria-current]");
    if (list && current) {
      list.scrollLeft =
        current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
    }
  }, [month]);

  return (
    <nav aria-label="Meses">
      <ul
        ref={row}
        className="flex items-center gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]"
      >
        {monthStrip(month).map((item) =>
          item.kind === "year" ? (
            <li
              key={`year-${item.label}`}
              className="shrink-0 px-1 text-base font-semibold text-ink tabular-nums"
            >
              {item.label}
            </li>
          ) : (
            <li key={item.key} className="shrink-0">
              <Link
                href={calendarHref("month", `${item.key}-01`)}
                aria-current={item.current ? "date" : undefined}
                className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-full px-4 text-base font-semibold press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${item.current ? "border border-accent-edge bg-accent text-on-accent" : "border border-control text-ink"}`}
              >
                {item.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
