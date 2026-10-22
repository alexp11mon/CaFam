import type { Metadata } from "next";
import { Suspense } from "react";
import { EventForm } from "@/components/calendar/event-form";
import { PageShell } from "@/components/calendar/page-shell";
import { LinkButton } from "@/components/ui/link-button";
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  todayKey,
} from "@/lib/calendar/format";
import {
  getCategoriesForCalendars,
  getMyCalendars,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { parseDateKey } from "@/lib/calendar/time-zone";
import { createEvent } from "../actions";

export const metadata: Metadata = { title: "Nuevo evento" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Reads the session and the URL, so it streams behind <Suspense> (cacheComponents).
async function NewEvent({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const { supabase, userId } = await requireUser();
  const [calendars, timeZone] = await Promise.all([
    getMyCalendars(supabase, userId),
    getProfileTimeZone(supabase, userId),
  ]);
  // Only calendars where the user can write (RF-27).
  const editable = calendars.filter((calendar) => calendar.role !== "viewer");

  if (editable.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-paper px-4 py-6 text-center text-ink">
        <p>No tienes ningún calendario donde puedas crear eventos.</p>
        <LinkButton href="/dashboard/calendars/new">
          Crear calendario
        </LinkButton>
      </div>
    );
  }

  const categories = await getCategoriesForCalendars(
    supabase,
    editable.map((calendar) => calendar.id),
  );
  const requested = typeof query.calendar === "string" ? query.calendar : "";
  const calendarId = editable.some((c) => c.id === requested)
    ? requested
    : editable[0]!.id;
  const date =
    typeof query.date === "string" && parseDateKey(query.date)
      ? query.date
      : todayKey(timeZone);

  return (
    <EventForm
      action={createEvent}
      initial={{
        title: "",
        calendarId,
        allDay: "",
        startDate: date,
        startTime: DEFAULT_START_TIME,
        endDate: date,
        endTime: DEFAULT_END_TIME,
        description: "",
        location: "",
        color: "",
        categoryId: "",
      }}
      calendars={editable.map(({ id, name, color }) => ({ id, name, color }))}
      categories={categories}
      submitLabel="Crear evento"
      pendingLabel="Creando…"
      cancelHref="/dashboard/calendar"
    />
  );
}

export default function NewEventPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <PageShell
      title="Nuevo evento"
      backHref="/dashboard/calendar"
      backLabel="Volver al calendario"
    >
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <NewEvent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
