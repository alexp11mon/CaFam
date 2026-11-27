import type { Metadata } from "next";
import { Suspense } from "react";
import { T } from "@/components/i18n/locale-provider";
import { NowBoard } from "@/components/now/now-board";
import { getBusyIntervals, getBusyPeople } from "@/lib/availability/queries";
import {
  getEventsInRange,
  getMyCalendars,
  getPeople,
  getPreferences,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { nowWindow } from "@/lib/now/window";

export const metadata: Metadata = { title: "Ahora" };

// Reads the session, so it streams behind <Suspense> (cacheComponents). Only
// today and tomorrow, not the calendar's wide window (spec 054 plan D1, D4).
async function Now() {
  const { supabase, userId } = await requireUser();
  const zoneRead = getProfileTimeZone(supabase, userId);
  const [timeZone, calendars, people, preferences, busyPeople, read] =
    await Promise.all([
      zoneRead,
      getMyCalendars(supabase, userId),
      getPeople(supabase),
      getPreferences(supabase, userId),
      getBusyPeople(supabase),
      zoneRead.then(async (zone) => {
        const window = nowWindow(zone);
        const [events, busy] = await Promise.all([
          getEventsInRange(supabase, window.from, window.to),
          getBusyIntervals(supabase, window.from, window.to),
        ]);
        return { day: window.day, readAt: window.now, events, busy };
      }),
    ]);

  return (
    <NowBoard
      data={{
        userId,
        timeZone,
        day: read.day,
        readAt: read.readAt,
        calendars: calendars.map(({ id, name, ownerId, color }) => ({
          id,
          name,
          ownerId,
          color,
        })),
        people,
        preferences,
        events: read.events.map(
          ({ id, calendarId, title, startsAt, endsAt, allDay, location }) => ({
            id,
            calendarId,
            title,
            startsAt,
            endsAt,
            allDay,
            location,
          }),
        ),
        busy: read.busy,
        busyPeople,
      }}
    />
  );
}

/** What each followed person is doing now and next (spec 054 RF-1). */
export default function NowPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-ink max-tab:sr-only">
        <T>{"Ahora"}</T>
      </h1>
      <Suspense
        fallback={
          <p className="text-muted">
            <T>{"Cargando…"}</T>
          </p>
        }
      >
        <Now />
      </Suspense>
    </main>
  );
}
