"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const STALE_MS = 60_000;

/**
 * Reloads the calendar data when the app comes back to the foreground more
 * than a minute after it was read (spec 008 RF-34). `loadedAt` comes from the
 * server, so a refresh also moves it forward.
 */
export function useRefreshOnFocus(loadedAt: number | undefined) {
  const router = useRouter();

  useEffect(() => {
    if (loadedAt === undefined) return;
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - loadedAt! > STALE_MS) router.refresh();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadedAt, router]);
}
