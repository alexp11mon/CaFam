import type { Metadata } from "next";
import { Suspense } from "react";
import { EventDetail } from "@/components/calendar/event-detail";
import { EventForm } from "@/components/calendar/event-form";
import { PageShell } from "@/components/calendar/page-shell";
import { deleteEvent, updateEvent } from "../actions";
import { loadEvent } from "../load-event";

export const metadata: Metadata = { title: "Evento" };

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function Event({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadEvent(id);

  return (
    <>
      <EventDetail
        event={data.detail}
        timeZone={data.timeZone}
        canEdit={data.canEdit}
        deleteAction={deleteEvent.bind(null, id)}
      />
      {data.canEdit ? (
        <section
          aria-labelledby="edit-heading"
          className="flex flex-col gap-4 border-t border-line pt-6"
        >
          <h2 id="edit-heading" className="text-lg font-semibold text-ink">
            Editar evento
          </h2>
          <EventForm
            action={updateEvent.bind(null, id)}
            initial={data.editInitial}
            calendars={data.calendars}
            categories={data.categories}
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
