import type { Metadata } from "next";
import { Suspense } from "react";
import { EventForm } from "@/components/calendar/event-form";
import { PageShell } from "@/components/calendar/page-shell";
import { LinkButton } from "@/components/ui/link-button";
import { createEvent } from "../actions";
import { loadNewEvent } from "../load-new-event";

export const metadata: Metadata = { title: "Nuevo evento" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Reads the session and the URL, so it streams behind <Suspense> (cacheComponents).
async function NewEvent({ searchParams }: { searchParams: SearchParams }) {
  const data = await loadNewEvent(await searchParams);

  if (data.kind === "no-calendar") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-paper px-4 py-6 text-center text-ink">
        <p>No tienes ningún calendario donde puedas crear eventos.</p>
        <LinkButton href="/dashboard/calendars/new">
          Crear calendario
        </LinkButton>
      </div>
    );
  }

  return (
    <EventForm
      action={createEvent}
      initial={data.initial}
      calendars={data.calendars}
      categories={data.categories}
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
