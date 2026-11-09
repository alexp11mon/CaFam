import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import {
  getMyCalendars,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { canWriteEvents } from "@/lib/sync/read-only";

export const metadata: Metadata = { title: "Asistente" };

// Spec 015 (RF-1): the chat reads the profile's zone to show the cited events;
// spec 022 adds the writable calendars for the proposal.
async function Chat() {
  const { supabase, userId } = await requireUser();
  const [timeZone, all] = await Promise.all([
    getProfileTimeZone(supabase, userId),
    getMyCalendars(supabase, userId),
  ]);
  // Spec 022 RF-26: only calendars where the user can create events.
  const calendars = all
    .filter(canWriteEvents)
    .map(({ id, name }) => ({ id, name }));
  return <AssistantChat timeZone={timeZone} calendars={calendars} />;
}

export default function AssistantPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6">
      <Suspense fallback={<p className="text-muted">Cargando el asistente…</p>}>
        <Chat />
      </Suspense>
    </main>
  );
}
