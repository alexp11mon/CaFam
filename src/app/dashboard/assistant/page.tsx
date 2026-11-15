import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { loadAssistantContext } from "./context-actions";

export const metadata: Metadata = { title: "Asistente" };

// Spec 024 RF-19: the page reads nothing, so the chat is on screen at once;
// the zone and the calendars arrive through `loadAssistantContext`.
export default function AssistantPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6">
      <AssistantChat loadContext={loadAssistantContext} />
    </main>
  );
}
