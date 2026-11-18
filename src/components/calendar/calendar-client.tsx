"use client";

import {
  addTransitionType,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import type { BusyInput } from "@/lib/availability/busy";
import {
  eventsInRange,
  type DayRange,
  type EventWindow,
} from "@/lib/calendar/event-window";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { coversRange } from "@/lib/offline/range";
import { monthMarks } from "@/lib/calendar/month-marks";
import {
  calendarHref,
  getVisibleRange,
  parseViewParams,
  type CalendarView,
} from "@/lib/calendar/ranges";
import { CAL_NEXT, CAL_PREV } from "@/lib/calendar/transition-types";
import { visibleDays } from "@/lib/calendar/view-options";
import { useEventWindow } from "@/lib/hooks/use-event-window";
import { useOfflineQueue, useOfflineSnapshot } from "@/lib/hooks/use-offline";
import { pendingView, withSeries } from "@/lib/offline/describe";
import { usePendingSeries } from "@/lib/hooks/use-pending-series";
import { mergeIntoCopy } from "@/lib/offline/snapshot-store";
import { useStableJson, useStableList } from "@/lib/hooks/use-stable-list";
import { Button } from "@/components/ui/button";
import type { AgendaEvent } from "./agenda-view";
import { CalendarHeading } from "./calendar-heading";
import { CalendarNavContext, type CalendarGo } from "./calendar-nav";
import { CalendarWorkspace, type PeriodEnter } from "./calendar-workspace";
import { ViewToolbar } from "./view-toolbar";

type WorkspaceProps = ComponentProps<typeof CalendarWorkspace>;

// Reading more days into the window renders this screen again; the workspace
// only does when what it shows changed (spec 024 RNF-5).
const Workspace = memo(CalendarWorkspace);
type Location = { view: CalendarView; date: string };

const CALENDAR_PATH = "/dashboard/calendar";

/** The view and date of the address bar, when it is the calendar's. */
function readLocation(today: string, fallback: CalendarView): Location | null {
  if (window.location.pathname !== CALENDAR_PATH) return null;
  const params = new URLSearchParams(window.location.search);
  return parseViewParams(
    {
      view: params.get("view") ?? undefined,
      date: params.get("date") ?? undefined,
    },
    today,
    fallback,
  );
}

const byStart = (a: AgendaEvent, b: AgendaEvent) =>
  a.startsAt < b.startsAt
    ? -1
    : a.startsAt > b.startsAt
      ? 1
      : a.id.localeCompare(b.id);

/**
 * The calendar screen in the browser (spec 024 RF-1..RF-9, plan D1, D2). The
 * server sends a wide window of events once; from then on the view and the
 * date live here, so a new period, another view or "Hoy" paint at once from
 * what is loaded, and the address changes with `history.pushState`. A refresh
 * (live change, focus, a write) brings a new window for the address shown.
 */
export function CalendarClient({
  initialView,
  initialDate,
  window: serverWindow,
  initialBusy,
  loadWindow,
  loadBusy,
  availableRange,
  ...workspace
}: {
  /** The days the offline copy holds; others are not shown (spec 034 RF-11). */
  availableRange?: DayRange;
  initialView: CalendarView;
  initialDate: string;
  /** Events from the weeks of the previous month to those of the next (RF-1). */
  window: EventWindow<AgendaEvent>;
  /** Busy times of the server's week or day (spec 020). */
  initialBusy: BusyInput[];
  loadWindow?: (
    from: string,
    to: string,
  ) => Promise<{ events: AgendaEvent[] } | { error: string }>;
  loadBusy?: (
    from: string,
    to: string,
  ) => Promise<{ busy: BusyInput[] } | { error: string }>;
} & Omit<
  WorkspaceProps,
  "view" | "date" | "days" | "events" | "monthMarks" | "busyIntervals" | "enter"
>) {
  const { today, timeZone, showWeekends = true, busyPeople = [] } = workspace;
  const [location, setLocation] = useState<{
    seen: EventWindow<AgendaEvent>;
    view: CalendarView;
    date: string;
    /** The side the last period came in by, and a count of those moves. */
    enter: PeriodEnter;
  }>({
    seen: serverWindow,
    view: initialView,
    date: initialDate,
    enter: { from: 0, move: 0 },
  });
  // A server render (first load, refresh, a link from another screen) is the
  // new starting point; the address wins if a swipe moved on meanwhile.
  if (location.seen !== serverWindow) {
    const current =
      typeof window === "undefined" ? null : readLocation(today, initialView);
    setLocation({
      seen: serverWindow,
      view: current?.view ?? initialView,
      date: current?.date ?? initialDate,
      enter: location.enter,
    });
  }
  const { view, date } = location;

  const go = useCallback<CalendarGo>((nextView, nextDate, types) => {
    const side =
      types?.length !== 1
        ? 0
        : types[0] === CAL_NEXT
          ? 1
          : types[0] === CAL_PREV
            ? -1
            : 0;
    if (side !== 0) {
      // A new period is the most repeated move: it is painted in this very
      // update, with no view transition, whose snapshot of the old period
      // delayed the new one some 60 ms (spec 024 H4, plan D13). The
      // workspace slides it in.
      setLocation((current) => ({
        ...current,
        view: nextView,
        date: nextDate,
        enter: { from: side, move: current.enter.move + 1 },
      }));
    } else {
      startTransition(() => {
        for (const type of types ?? []) addTransitionType(type);
        setLocation((current) => ({
          ...current,
          view: nextView,
          date: nextDate,
        }));
      });
    }
    // Next keeps its router in step with the address (plan D2): a later
    // refresh reads the window of this date.
    const href = calendarHref(nextView, nextDate);
    if (window.location.pathname + window.location.search !== href) {
      window.history.pushState(null, "", href);
    }
  }, []);

  // Back and forward between periods; never while another screen is shown
  // (Activity keeps this one mounted, plan R2).
  useEffect(() => {
    function onPopState() {
      const current = readLocation(today, initialView);
      if (current) setLocation((old) => ({ ...old, ...current }));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [today, initialView]);

  const events = useEventWindow({
    initial: serverWindow,
    view,
    date,
    load: loadWindow,
  });

  // What waits on the device is drawn as it will be (spec 034 RF-26, RF-28).
  const { queue } = useOfflineQueue();
  const copy = useOfflineSnapshot();
  const calendars = copy?.calendars ?? NO_CALENDARS;
  // Series changed offline, as they will be (spec 035 RF-12).
  const seriesView = usePendingSeries(copy, queue);
  const withPending = useMemo(() => {
    const view = pendingView(events.events, queue, calendars);
    return seriesView
      ? withSeries(view, seriesView.events, seriesView.touched)
      : view;
  }, [events.events, queue, calendars, seriesView]);
  // A window the server read again keeps the device's copy fresh (RF-5, D9).
  // Not in the offline app, whose window is the copy itself. Again once the
  // copy is read from the device, which comes after the page.
  const hasCopy = copy !== null;
  useEffect(() => {
    if (!availableRange && hasCopy) {
      void mergeIntoCopy(serverWindow).catch(() => {});
    }
  }, [serverWindow, availableRange, hasCopy]);

  const range = useMemo(
    () => getVisibleRange(view, date, timeZone),
    [view, date, timeZone],
  );
  // The same 7-day reading; only week and month drop the weekends (spec 019 plan D11).
  const days = useMemo(
    () =>
      view === "week" || view === "month"
        ? visibleDays(range.days, showWeekends)
        : range.days,
    [view, range, showWeekends],
  );
  // A stable array while nothing changes: the optimistic changes of the
  // workspace hang from it (spec 017).
  const shown = useStableList(
    useMemo(
      () => eventsInRange(withPending, range.from, range.to).sort(byStart),
      [withPending, range],
    ),
  );
  // Dots of the mini month, from the same window (RF-8).
  const month = date.slice(0, 7);
  const marks = useStableJson(
    useMemo(() => {
      const monthRange = getVisibleRange("month", `${month}-01`, timeZone);
      return monthMarks(
        eventsInRange(withPending, monthRange.from, monthRange.to),
        monthRange.days,
        timeZone,
      );
    }, [withPending, month, timeZone]),
  );

  // "Ocupado" blocks: the server's for its own week or day, the rest asked
  // for when someone is marked (RF-9, plan D5).
  const gridView = view === "week" || view === "4days" || view === "day";
  const busyKey = gridView ? `${view}|${range.days[0]}` : null;
  const [busy, setBusy] = useState<{
    seen: BusyInput[];
    byKey: Map<string, BusyInput[]>;
  }>(() => ({
    seen: initialBusy,
    byKey: new Map([
      [
        `${initialView}|${rangeStart(initialView, initialDate, timeZone)}`,
        initialBusy,
      ],
    ]),
  }));
  if (busy.seen !== initialBusy) {
    setBusy({
      seen: initialBusy,
      byKey: new Map([[`${view}|${range.days[0]}`, initialBusy]]),
    });
  }
  const anyoneShown = busyPeople.some((person) => person.shown);
  const busyKnown = busyKey ? busy.byKey.get(busyKey) : undefined;
  useEffect(() => {
    if (!busyKey || !loadBusy || !anyoneShown || busyKnown) return;
    let dropped = false;
    void loadBusy(range.days[0]!, range.days.at(-1)!)
      .then((result) => {
        if (dropped || "error" in result) return;
        setBusy((current) => ({
          ...current,
          byKey: new Map(current.byKey).set(busyKey, result.busy),
        }));
      })
      .catch(() => {});
    return () => {
      dropped = true;
    };
  }, [busyKey, loadBusy, anyoneShown, busyKnown, range]);

  return (
    <CalendarNavContext value={go}>
      {/* On a phone the header, the drawer and "+" do this (spec 016 RF-19). */}
      {/* Fixed while scrolling, so the views stay at hand (agenda bug, 2026-11-01). */}
      <div className="sticky top-[4.5rem] z-20 flex flex-wrap items-center justify-between gap-3 rounded-card surface px-4 py-3 max-tab:hidden">
        <ViewToolbar
          view={view}
          date={date}
          today={today}
          saveLastView={workspace.saveLastView}
          showWeekends={showWeekends}
        />
      </div>
      <CalendarHeading
        view={view}
        date={date}
        today={today}
        saveLastView={workspace.saveLastView}
      />
      {/* A period that was not loaded: the view is already there, its events
          are on their way (RF-4). */}
      <p role="status" className="sr-only">
        {events.loading ? "Cargando eventos…" : ""}
      </p>
      {availableRange &&
      view !== "year" &&
      !coversRange(availableRange, {
        from: range.days[0]!,
        to: range.days.at(-1)!,
      }) ? (
        <p
          role="alert"
          className="rounded-control border border-line bg-paper px-4 py-3 text-ink"
        >
          {OFFLINE_MESSAGES.outOfRange}
        </p>
      ) : null}
      {events.failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger bg-paper px-4 py-3 text-danger"
        >
          <span>No se han podido cargar los eventos de estas fechas.</span>
          <Button variant="secondary" onClick={events.retry}>
            Reintentar
          </Button>
        </div>
      ) : null}
      <div
        aria-busy={events.loading || undefined}
        data-loading={events.loading || undefined}
        className="flex min-h-0 flex-1 flex-col transition-opacity duration-(--motion-fast-in) data-loading:opacity-70"
      >
        <Workspace
          {...workspace}
          view={view}
          date={date}
          enter={location.enter}
          days={days}
          events={shown}
          monthMarks={marks}
          busyIntervals={busyKnown ?? EMPTY_BUSY}
          availableRange={availableRange}
        />
      </div>
    </CalendarNavContext>
  );
}

const EMPTY_BUSY: BusyInput[] = [];
const NO_CALENDARS: { id: string; name: string; color: string }[] = [];

function rangeStart(view: CalendarView, date: string, timeZone: string) {
  return getVisibleRange(view, date, timeZone).days[0];
}
