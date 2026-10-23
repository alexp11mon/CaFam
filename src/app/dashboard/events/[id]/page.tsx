import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventDetail } from "@/components/calendar/event-detail";
import { EventForm } from "@/components/calendar/event-form";
import { PageShell } from "@/components/calendar/page-shell";
import { authorLabel } from "@/lib/account/author-label";
import { eventToFormDates } from "@/lib/calendar/format";
import {
  getCalendar,
  getCategoriesForCalendars,
  getEvent,
  getMyCalendars,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { getMembers } from "@/lib/sharing/queries";
import { deleteEvent, updateEvent } from "../actions";

export const metadata: Metadata = { title: "Evento" };

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function Event({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const event = await getEvent(supabase, id);
  const calendar = event
    ? await getCalendar(supabase, userId, event.calendarId)
    : null;
  if (!event || !calendar) notFound();

  const canEdit = calendar.role !== "viewer"; // RF-26
  const timeZone = await getProfileTimeZone(supabase, userId);
  const myCalendars = canEdit ? await getMyCalendars(supabase, userId) : [];
  const editable = myCalendars.filter((c) => c.role !== "viewer");
  const categories = await getCategoriesForCalendars(
    supabase,
    canEdit ? editable.map((c) => c.id) : [event.calendarId],
  );
  const category = categories.find((c) => c.id === event.categoryId);
  const members = await getMembers(supabase, [event.calendarId]);

  return (
    <>
      <EventDetail
        event={{
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          allDay: event.allDay,
          description: event.description,
          location: event.location,
          color: event.color,
          calendarName: calendar.name,
          calendarColor: calendar.color,
          categoryName: category?.name ?? null,
          author: authorLabel(event.createdBy, members),
        }}
        timeZone={timeZone}
        canEdit={canEdit}
        deleteAction={deleteEvent.bind(null, id)}
      />
      {canEdit ? (
        <section
          aria-labelledby="edit-heading"
          className="flex flex-col gap-4 border-t border-line pt-6"
        >
          <h2 id="edit-heading" className="text-lg font-semibold text-ink">
            Editar evento
          </h2>
          <EventForm
            action={updateEvent.bind(null, id)}
            initial={{
              title: event.title,
              calendarId: event.calendarId,
              allDay: event.allDay ? "on" : "",
              ...eventToFormDates(event, timeZone),
              description: event.description ?? "",
              location: event.location ?? "",
              color: event.color ?? "",
              categoryId: event.categoryId ?? "",
            }}
            calendars={editable.map(({ id, name, color }) => ({
              id,
              name,
              color,
            }))}
            categories={categories}
            submitLabel="Guardar cambios"
            pendingLabel="Guardando…"
            cancelHref="/dashboard/calendar"
          />
        </section>
      ) : null}
    </>
  );
}

export default function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell
      title="Evento"
      backHref="/dashboard/calendar"
      backLabel="Volver al calendario"
    >
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Event params={params} />
      </Suspense>
    </PageShell>
  );
}
