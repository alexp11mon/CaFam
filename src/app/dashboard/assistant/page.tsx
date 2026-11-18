import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { loadAssistantContext } from "./context-actions";

export const metadata: Metadata = { title: "Asistente" };

// The chat on a page of its own, for a link or a reload; day to day it opens
// from Venito's button without leaving the screen (spec 027 RF-2). The page
// reads nothing: the zone and the calendars arrive through
// `loadAssistantContext` (spec 024 RF-19).
export default function AssistantPage() {
  return (
    <main className="mx-auto flex h-[calc(100dvh-7.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-2xl flex-col tab:h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] tab:py-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden tab:rounded-card tab:surface">
        <AssistantChat loadContext={loadAssistantContext} />
      </div>
    </main>
  );
}
