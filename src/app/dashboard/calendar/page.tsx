import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DayView } from "@/components/calendar/day-view";
import { MonthView } from "@/components/calendar/month-view";
import { ViewToolbar } from "@/components/calendar/view-toolbar";
import { WeekView } from "@/components/calendar/week-view";
import { LinkButton } from "@/components/ui/link-button";
import { todayKey } from "@/lib/calendar/format";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import {
  getEventsInRange,
  getMyCalendars,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { getVisibleRange, parseViewParams } from "@/lib/calendar/ranges";

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

  const [calendars, records] = await Promise.all([
    getMyCalendars(supabase, userId),
    getEventsInRange(supabase, range.from, range.to),
  ]);

  if (calendars.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-brand-soft/40 px-4 py-6 text-center text-ink">
        <p>Todavía no tienes calendarios.</p>
        <LinkButton href="/dashboard/calendars/new">
          Crear calendario
        </LinkButton>
      </div>
    );
  }

  // An event without its own color takes its calendar's (RF-17).
  const colors = new Map(calendars.map((c) => [c.id, c.color]));
  const events: CalendarEventItem[] = records.map((record) => ({
    id: record.id,
    title: record.title,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    allDay: record.allDay,
    calendarId: record.calendarId,
    categoryId: record.categoryId,
    color:
      record.color ?? colors.get(record.calendarId) ?? DEFAULT_CALENDAR_COLOR,
  }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewToolbar view={view} date={date} today={today} />
        <LinkButton href={`/dashboard/events/new?date=${date}`}>
          Nuevo evento
        </LinkButton>
      </div>
      {view === "month" ? (
        <MonthView
          date={date}
          days={range.days}
          events={events}
          timeZone={timeZone}
          today={today}
        />
      ) : view === "week" ? (
        <WeekView
          days={range.days}
          events={events}
          timeZone={timeZone}
          today={today}
        />
      ) : (
        <DayView day={date} events={events} timeZone={timeZone} today={today} />
      )}
    </>
  );
}

export default function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1 border-b border-ink/10 pb-4">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline"
        >
          ← Volver al panel
        </Link>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Calendario</h1>
      </header>
      <Suspense fallback={<p className="text-ink/70">Cargando calendario…</p>}>
        <CalendarContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
