"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { takeRemoteRefresh } from "@/lib/calendar/live-hold";

/**
 * The window's event no longer exists, usually because it was just deleted
 * there: the revalidated route comes back empty before the delete dialog can
 * close the window, so this closes it (spec 008 RF-8, RF-32).
 */
export function GoneEvent() {
  const router = useRouter();
  const { show } = useToast();

  useEffect(() => {
    // Someone else deleted it if a live refresh brought this (spec 019 RF-44).
    show(
      takeRemoteRefresh()
        ? "Otra persona ha borrado este evento"
        : "Evento borrado",
    );
    router.back();
  }, [router, show]);

  return null;
}
