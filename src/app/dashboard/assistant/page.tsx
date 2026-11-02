import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { getProfileTimeZone, requireUser } from "@/lib/calendar/queries";

export const metadata: Metadata = { title: "Asistente" };

// Spec 015 (RF-1): the chat reads the profile's zone to show the cited events.
async function Chat() {
  const { supabase, userId } = await requireUser();
  const timeZone = await getProfileTimeZone(supabase, userId);
  return <AssistantChat timeZone={timeZone} />;
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
