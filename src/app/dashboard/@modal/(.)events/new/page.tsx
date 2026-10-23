import { Suspense } from "react";
import { EventForm } from "@/components/calendar/event-form";
import { EventModal } from "@/components/calendar/event-modal";
import { LinkButton } from "@/components/ui/link-button";
import { createEvent } from "../../../events/actions";
import { loadNewEvent } from "../../../events/load-new-event";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Reads the session and the URL, so it streams behind <Suspense> (cacheComponents).
async function InterceptedNewEvent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const data = await loadNewEvent(await searchParams);

  return (
    <EventModal title="Nuevo evento">
      {data.kind === "no-calendar" ? (
        <div className="flex flex-col items-start gap-4 text-ink">
          <p>No tienes ningún calendario donde puedas crear eventos.</p>
          <LinkButton href="/dashboard/calendars/new">
            Crear calendario
          </LinkButton>
        </div>
      ) : (
        <EventForm
          action={createEvent}
          initial={data.initial}
          calendars={data.calendars}
          categories={data.categories}
          submitLabel="Crear evento"
          pendingLabel="Creando…"
          cancelHref="/dashboard/calendar"
        />
      )}
    </EventModal>
  );
}

// "+ Evento" and "Crear" open the form over the calendar (spec 008 RF-1, plan D1).
export default function InterceptedNewEventPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={null}>
      <InterceptedNewEvent searchParams={searchParams} />
    </Suspense>
  );
}
