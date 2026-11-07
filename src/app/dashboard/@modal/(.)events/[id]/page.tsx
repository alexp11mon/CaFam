import { Suspense } from "react";
import { EventModal } from "@/components/calendar/event-modal";
import { EventPanel } from "@/components/calendar/event-panel";
import { GoneEvent } from "@/components/calendar/gone-event";
import { updateEvent } from "../../../events/actions";
import { deleteFromDetail } from "../../../events/quick-actions";
import { loadEvent } from "../../../events/load-event";

type SearchParams = Promise<{ edit?: string | string[] }>;

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function InterceptedEvent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const data = await loadEvent(id);
  // Deleting from the window re-renders this route: the event is gone, and a
  // 404 here would replace the whole page.
  if (!data) return <GoneEvent />;

  return (
    <EventModal title={data.detail.title} variant="sheet" morphId={id}>
      <EventPanel
        detail={data.detail}
        timeZone={data.timeZone}
        canEdit={data.canEdit}
        canAttach={data.canAttach}
        images={data.images}
        editInitial={data.editInitial}
        series={data.series}
        calendars={data.calendars}
        categories={data.categories}
        updateAction={updateEvent.bind(null, id)}
        deleteAction={deleteFromDetail.bind(null, id)}
        // "Editar" of the detail card (spec 019 RF-9).
        startEditing={edit === "1" && data.canEdit}
      />
    </EventModal>
  );
}

// An event opened from inside the app shows over the calendar (spec 008 RF-2, plan D1).
export default function InterceptedEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={null}>
      <InterceptedEvent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
