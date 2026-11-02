"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeSection } from "@/lib/shell/nav";
import { AssistantIcon } from "./icons";

/**
 * The round "Asistente" button on every screen of the panel but its own, in
 * paper so the ink "+" stays the main action (spec 015 RF-39, plan D18). On a
 * phone it goes above the "+" when the frame says there is one
 * (`data-has-fab`), over the bottom bar between 769 and 1023 px and in the
 * corner from 1024 px.
 */
export function AssistantFab() {
  const pathname = usePathname();
  if (activeSection(pathname) === "assistant") return null;
  return (
    <Link
      href="/dashboard/assistant"
      aria-label="Asistente"
      className="fixed right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full text-ink glass-float press hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max-tab:group-data-[has-fab]/frame:bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+4.25rem)] tab:bottom-24 lg:right-6 lg:bottom-6"
    >
      <AssistantIcon />
    </Link>
  );
}
