import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventModal } from "@/components/calendar/event-modal";
import { getEvent, requireUser } from "@/lib/calendar/queries";

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function InterceptedEvent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const event = await getEvent(supabase, id);
  if (!event) notFound();
  return <EventModal title={event.title}>{null}</EventModal>;
}

// An event opened from inside the app shows over the calendar (spec 008 RF-2, plan D1).
export default function InterceptedEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <InterceptedEvent params={params} />
    </Suspense>
  );
}
