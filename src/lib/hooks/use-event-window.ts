"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  mergeWindow,
  planLoad,
  trimWindow,
  visibleDayRange,
  warmRange,
  type DayRange,
  type EventWindow,
} from "@/lib/calendar/event-window";
import type { CalendarView } from "@/lib/calendar/ranges";

type WindowEvent = { id: string; startsAt: string; endsAt: string };

/** Idle time before the periods next to the visible one are read (RF-3). */
export const PREFETCH_DELAY_MS = 200;

const keyOf = (range: DayRange) => `${range.from}|${range.to}`;

/**
 * The events the browser has (spec 024 RF-2..RF-6, plan D1, D4). It starts
 * with the server's window and replaces it whenever the server sends a new
 * one (a refresh: live change, focus or a write, RF-5). A period that is not
 * loaded is read at once; with the user still, one more period on each side.
 */
export function useEventWindow<T extends WindowEvent>({
  initial,
  view,
  date,
  load,
}: {
  /** The server's window: a new object on every server render. */
  initial: EventWindow<T>;
  view: CalendarView;
  date: string;
  load?: (
    from: string,
    to: string,
  ) => Promise<{ events: T[] } | { error: string }>;
}) {
  const [state, setState] = useState<{
    source: EventWindow<T>;
    window: EventWindow<T>;
    /** The read that failed: not repeated until the period changes (RF-4). */
    failed: string | null;
  }>({ source: initial, window: initial, failed: null });
  // Fresh server data is the new starting point.
  if (state.source !== initial) {
    setState({ source: initial, window: initial, failed: null });
  }
  const window = state.source === initial ? state.window : initial;
  const failed = state.source === initial ? state.failed : null;

  const visible = useMemo(() => visibleDayRange(view, date), [view, date]);
  const cold = planLoad(window.range, visible);
  const plan = cold ?? planLoad(window.range, warmRange(view, date));
  const planKey = plan
    ? `${plan.mode}:${plan.ranges.map(keyOf).join(",")}`
    : null;

  const latest = useRef({ initial, visible });
  useEffect(() => {
    latest.current = { initial, visible };
  });
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    if (!plan || !planKey || !load || failed === planKey) return;
    if (inFlight.current.has(planKey)) return;
    const source = initial;
    const timer = setTimeout(
      async () => {
        inFlight.current.add(planKey);
        let results: ({ events: T[] } | { error: string })[];
        try {
          results = await Promise.all(
            plan.ranges.map((range) => load(range.from, range.to)),
          );
        } catch {
          results = [{ error: "connection" }];
        }
        inFlight.current.delete(planKey);
        setState((current) => {
          // A refresh arrived meanwhile: its window is newer (RF-5).
          if (current.source !== source) return current;
          if (results.some((result) => "error" in result)) {
            return { ...current, failed: planKey };
          }
          let next = current.window;
          plan.ranges.forEach((range, index) => {
            const fetched = {
              range,
              events: (results[index] as { events: T[] }).events,
            };
            const how = planLoad(next.range, range);
            if (how === null || how.mode === "extend") {
              next = mergeWindow(next, fetched, "extend");
            } else if (planLoad(range, latest.current.visible) === null) {
              // A far jump: only if it is still what the screen shows.
              next = fetched;
            }
          });
          return {
            ...current,
            window: trimWindow(next, latest.current.visible),
            failed: null,
          };
        });
      },
      cold ? 0 : PREFETCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
    // `plan` is described by `planKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, load, initial, failed, cold === null]);

  // Asks again for a period whose read failed (spec 026 RF-8).
  const retry = useCallback(
    () => setState((current) => ({ ...current, failed: null })),
    [],
  );

  return {
    retry,
    events: window.events,
    range: window.range,
    /** The visible period is still being read (RF-4). */
    loading: cold !== null && failed !== planKey,
    /** Reading the visible period failed. */
    failed: cold !== null && failed === planKey,
  };
}
