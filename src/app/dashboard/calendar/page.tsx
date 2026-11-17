import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { getBusyIntervals, getBusyPeople } from "@/lib/availability/queries";
import { eventsInRange, serverWindow } from "@/lib/calendar/event-window";
import { todayKey } from "@/lib/calendar/format";
import { nextEventsWindow } from "@/lib/calendar/next-event";
import { calendarProps } from "@/lib/calendar/calendar-props";
import {
  getCalendarProfile,
  getEventsInRange,
  getGroups,
  getMyCalendars,
  getMyCategories,
  getPeople,
  getPreferences,
  requireUser,
} from "@/lib/calendar/queries";
import {
  daysRange,
  getVisibleRange,
  isCalendarView,
  parseViewParams,
} from "@/lib/calendar/ranges";
import { toViewEvents } from "@/lib/calendar/to-view-events";
import { setGroupVisibility } from "../calendars/group-actions";
import { createEvent } from "../events/actions";
import { loadAgendaEvents } from "./agenda-actions";
import { loadMonthMarks } from "./mini-month-actions";
import {
  saveLastView,
  saveOrder,
  setCalendarVisibility,
  setPersonVisibility,
  setShowBusy,
} from "./preferences-actions";
import { loadBusy, loadCalendarWindow } from "./window-actions";

export const metadata: Metadata = { title: "Calendario" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Reads the session and the URL, so it streams behind <Suspense> (cacheComponents).
async function CalendarContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const { supabase, userId } = await requireUser();
  // Nothing below waits for the profile but the events, which need its zone
  // (spec 024 RF-10).
  const profileRead = getCalendarProfile(supabase, userId);
  const upcomingWindow = nextEventsWindow();

  const [
    profile,
    calendars,
    people,
    preferences,
    userGroups,
    busyPeople,
    categories,
    read,
  ] = await Promise.all([
    profileRead,
    getMyCalendars(supabase, userId),
    getPeople(supabase),
    getPreferences(supabase, userId),
    getGroups(supabase, userId),
    getBusyPeople(supabase),
    getMyCategories(supabase),
    profileRead.then(async ({ timeZone, lastView }) => {
      const today = todayKey(timeZone);
      const { view, date } = parseViewParams(query, today, lastView);
      // One wide reading: the browser changes period inside it with no
      // request (spec 024 RF-1, plan D1, D3).
      const days = serverWindow(date);
      const window = daysRange(days.from, days.to, timeZone);
      const range = getVisibleRange(view, date, timeZone);
      const covered =
        window.from <= upcomingWindow.from && upcomingWindow.to <= window.to;
      const [records, upcoming, busyIntervals] = await Promise.all([
        getEventsInRange(supabase, window.from, window.to),
        // "Próximo evento" comes out of the window when today is in it (RF-8).
        covered
          ? null
          : getEventsInRange(supabase, upcomingWindow.from, upcomingWindow.to),
        // Only the week and the day show them (spec 020 RF-16).
        view === "week" || view === "day"
          ? getBusyIntervals(supabase, range.from, range.to)
          : [],
      ]);
      return {
        today,
        view,
        date,
        days,
        records,
        upcoming:
          upcoming ??
          eventsInRange(records, upcomingWindow.from, upcomingWindow.to),
        busyIntervals,
      };
    }),
  ]);
  const { timeZone } = profile;
  const { today, view, date } = read;

  if (calendars.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Todavía no tienes calendarios"
          action={
            <LinkButton href="/dashboard/calendars/new">
              Crear calendario
            </LinkButton>
          }
        >
          Crea el primero para empezar a apuntar eventos, o únete al de otra
          persona desde «Más».
        </EmptyState>
      </Card>
    );
  }

  const { canCreate, nextEvents, groups, editableCalendars } = calendarProps({
    userId,
    calendars,
    people,
    groups: userGroups,
    preferences,
    upcoming: read.upcoming,
  });

  return (
    <CalendarClient
      initialView={view}
      initialDate={date}
      window={{
        range: read.days,
        events: toViewEvents(read.records, calendars),
      }}
      initialBusy={read.busyIntervals}
      loadWindow={loadCalendarWindow}
      loadBusy={loadBusy}
      today={today}
      timeZone={timeZone}
      canCreate={canCreate}
      groups={groups}
      categories={categories}
      setCalendarVisibility={setCalendarVisibility}
      setPersonVisibility={setPersonVisibility}
      setGroupVisibility={setGroupVisibility}
      saveOrder={saveOrder}
      nextEvents={nextEvents}
      loadedAt={upcomingWindow.loadedAt}
      loadMonthMarks={loadMonthMarks}
      saveLastView={saveLastView}
      loadAgendaEvents={loadAgendaEvents}
      editableCalendars={editableCalendars}
      createAction={createEvent}
      userId={userId}
      showWeekends={profile.showWeekends}
      defaultDuration={profile.duration}
      busyPeople={busyPeople}
      setShowBusy={setShowBusy}
    />
  );
}

// Only the URL, no session: picks the shape of the loading view (spec 008 RF-33).
async function ShapedLoading({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const view = isCalendarView(query.view) ? query.view : "agenda";
  return (
    // No key: moving between periods keeps the current view on screen until the
    // next one is ready (no empty screen either) and keeps the panel's state.
    <Suspense fallback={<CalendarSkeleton view={view} />}>
      <CalendarContent searchParams={searchParams} />
    </Suspense>
  );
}

export default function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 max-tab:gap-2 max-tab:pt-1 max-tab:pb-0 sm:px-6">
      {/* The phone header already names the month (spec 016 RF-8). */}
      <h1 className="text-2xl font-semibold text-ink max-tab:sr-only">
        Calendario
      </h1>
      <Suspense fallback={<CalendarSkeleton view="agenda" />}>
        <ShapedLoading searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
