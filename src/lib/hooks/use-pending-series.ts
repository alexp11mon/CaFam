"use client";

import { useEffect, useState } from "react";
import { toViewEvents, type AgendaEvent } from "@/lib/calendar/to-view-events";
import { touchedSeries } from "@/lib/offline/describe";
import type { OutboxEntry } from "@/lib/offline/outbox";
import { pendingEvents } from "@/lib/offline/overlay";
import type { Snapshot } from "@/lib/offline/snapshot";

export interface SeriesView {
  events: AgendaEvent[];
  touched: Set<string>;
}

/**
 * The occurrences of the series changed offline, as they will be (spec 035
 * RF-12). The expansion needs ical.js: loaded only when such a change waits
 * (plan R5). Null while there is none, or before it is loaded.
 */
export function usePendingSeries(
  copy: Snapshot | null,
  queue: readonly OutboxEntry[],
): SeriesView | null {
  const [view, setView] = useState<SeriesView | null>(null);
  const touched = touchedSeries(queue);
  const any = touched.size > 0;
  useEffect(() => {
    if (!any || !copy) return;
    let live = true;
    void import("@/lib/offline/series-overlay").then(({ pendingSeries }) => {
      if (!live) return;
      const events = pendingSeries(
        {
          events: pendingEvents(copy.events, queue),
          series: copy.series,
          exceptions: copy.exceptions,
          range: copy.range,
          timeZone: copy.profile.timeZone,
        },
        queue,
      );
      const all = touchedSeries(queue);
      // A split series gets a new id: its occurrences come marked pending.
      for (const event of events) {
        if (event.pending && event.seriesId) all.add(event.seriesId);
      }
      const drawn = toViewEvents(events, copy.calendars).map((event, i) =>
        events[i]?.pending ? { ...event, pending: true } : event,
      );
      setView({ events: drawn, touched: all });
    });
    return () => {
      live = false;
      setView(null);
    };
  }, [any, copy, queue]);
  return any ? view : null;
}
