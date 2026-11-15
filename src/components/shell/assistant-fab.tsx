"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { activeSection } from "@/lib/shell/nav";
import { AssistantIcon } from "./icons";

/**
 * The round "Asistente" button on every screen of the panel but its own
 * (spec 015 RF-39). The bottom right corner is its own since "+" moved to
 * the bottom bar (spec 025 plan D7): just above the bar up to 1023 px, in the
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
      className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] max-tab:group-data-[has-dock]/frame:bottom-[calc(7.25rem+env(safe-area-inset-bottom)+0.75rem)] z-20 flex size-14 items-center justify-center rounded-full text-ink surface-float press hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:right-6 lg:bottom-6"
    >
      <AssistantIcon />
    </Link>
  );
}
