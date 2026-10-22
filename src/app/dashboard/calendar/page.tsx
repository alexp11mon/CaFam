import type { Metadata } from "next";
import { Suspense } from "react";
import type { AgendaEvent } from "@/components/calendar/agenda-view";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { ViewToolbar } from "@/components/calendar/view-toolbar";
import { LinkButton } from "@/components/ui/link-button";
import { todayKey } from "@/lib/calendar/format";
import { groupByPerson } from "@/lib/calendar/grouping";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import {
  getCategoriesForCalendars,
  getEventsInRange,
  getMyCalendars,
  getPeople,
  getPreferences,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { getVisibleRange, parseViewParams } from "@/lib/calendar/ranges";
import {
  saveOrder,
  setCalendarVisibility,
  setPersonVisibility,
} from "./preferences-actions";

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
  const timeZone = await getProfileTimeZone(supabase, userId);
  const today = todayKey(timeZone);
  const { view, date } = parseViewParams(query, today);
  const range = getVisibleRange(view, date, timeZone);

  const [calendars, records, people, preferences] = await Promise.all([
    getMyCalendars(supabase, userId),
    getEventsInRange(supabase, range.from, range.to),
    getPeople(supabase),
    getPreferences(supabase, userId),
  ]);

  if (calendars.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-paper px-4 py-6 text-center text-ink">
        <p>Todavía no tienes calendarios.</p>
        <LinkButton href="/dashboard/calendars/new">
          Crear calendario
        </LinkButton>
      </div>
    );
  }

  // An event without its own color takes its calendar's (RF-17).
  const colors = new Map(calendars.map((c) => [c.id, c.color]));
  const names = new Map(calendars.map((c) => [c.id, c.name]));
  const events: AgendaEvent[] = records.map((record) => ({
    id: record.id,
    title: record.title,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    allDay: record.allDay,
    calendarId: record.calendarId,
    categoryId: record.categoryId,
    color:
      record.color ?? colors.get(record.calendarId) ?? DEFAULT_CALENDAR_COLOR,
    location: record.location,
    calendarName: names.get(record.calendarId) ?? "",
  }));
  const canCreate = calendars.some((calendar) => calendar.role !== "viewer");

  const categories = await getCategoriesForCalendars(
    supabase,
    calendars.map((calendar) => calendar.id),
  );
  // People, calendars and their saved order and visibility (RF-42, RF-45, RF-46).
  const groups = groupByPerson({
    currentUserId: userId,
    people,
    calendars: calendars.map(({ id, name, ownerId, createdAt, color }) => ({
      id,
      name,
      ownerId,
      createdAt,
      color,
    })),
    ...preferences,
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewToolbar view={view} date={date} today={today} />
        {/* On a phone "+ Evento" lives in the bottom bar (spec 005 RF-22). */}
        {canCreate ? (
          <div className="hidden lg:block">
            <LinkButton href={`/dashboard/events/new?date=${date}`}>
              Nuevo evento
            </LinkButton>
          </div>
        ) : null}
      </div>
      <CalendarWorkspace
        view={view}
        date={date}
        days={range.days}
        today={today}
        timeZone={timeZone}
        events={events}
        canCreate={canCreate}
        groups={groups}
        categories={categories}
        setCalendarVisibility={setCalendarVisibility}
        setPersonVisibility={setPersonVisibility}
        saveOrder={saveOrder}
      />
    </>
  );
}

export default function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Calendario</h1>
      <Suspense fallback={<p className="text-muted">Cargando calendario…</p>}>
        <CalendarContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
