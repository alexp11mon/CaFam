"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
  const warmed = useRef(false);
  // The chat's own JS, fetched while nothing else is going on, so the first
  // opening does not wait for it (spec 024 RF-19).
  useEffect(() => {
    const load = () => void import("@/components/assistant/assistant-chat");
    if (typeof requestIdleCallback === "function") {
      const idle = requestIdleCallback(load, { timeout: 4000 });
      return () => cancelIdleCallback(idle);
    }
    const timer = setTimeout(load, 2000);
    return () => clearTimeout(timer);
  }, []);
  if (activeSection(pathname) === "assistant") return null;
  // The finger is on the button: wake the assistant's function up now, so
  // the first question does not pay the cold start (spec 024 RF-19).
  const warm = () => {
    if (warmed.current) return;
    warmed.current = true;
    void fetch("/api/assistant").catch(() => {});
  };
  return (
    <Link
      href="/dashboard/assistant"
      aria-label="Asistente"
      onPointerDown={warm}
      onFocus={warm}
      className="fixed right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full text-ink surface-float press hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max-tab:group-data-[has-fab]/frame:bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+4.25rem)] tab:bottom-24 lg:right-6 lg:bottom-6"
    >
      <AssistantIcon />
    </Link>
  );
}
