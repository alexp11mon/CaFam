"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { liveDecision } from "@/lib/calendar/live";
import {
  isLiveHeld,
  markRemoteRefresh,
  onLiveRelease,
} from "@/lib/calendar/live-hold";
import { createClient } from "@/lib/supabase/client";

/** Waits for a burst of messages (a sync, a merge) to end: one refresh (RF-41). */
const GATHER_MS = 400;

/**
 * Someone else's changes on screen without reloading (spec 019 plan
 * live-client, D1 to D7): the user's private topic tells that something
 * changed and the calendar reads again with RLS. Only while the tab is visible.
 */
export function useLiveCalendar(
  userId: string | undefined,
  onUpdate?: () => void,
) {
  const router = useRouter();
  const update = useRef(onUpdate);
  useEffect(() => {
    update.current = onUpdate;
  });

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let starting = false;
    let disposed = false;
    let subscribedOnce = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let waiting: (() => void) | null = null;

    function refresh() {
      if (isLiveHeld()) {
        // RF-43: once the drag, quick window or form ends.
        waiting ??= onLiveRelease(() => {
          waiting?.();
          waiting = null;
          refresh();
        });
        return;
      }
      markRemoteRefresh();
      router.refresh();
      update.current?.();
    }

    function receive(actor: string | null) {
      if (liveDecision({ actor, me: userId!, held: false }) === "ignore")
        return;
      clearTimeout(timer);
      timer = setTimeout(refresh, GATHER_MS);
    }

    async function start() {
      if (channel || starting) return;
      starting = true;
      await supabase.realtime.setAuth();
      starting = false;
      if (disposed || document.visibilityState !== "visible") return;
      channel = supabase
        .channel(`user:${userId}`, { config: { private: true } })
        .on("broadcast", { event: "changed" }, ({ payload }) =>
          receive((payload as { actor?: string | null }).actor ?? null),
        )
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          // A new subscription after hiding the tab or losing the connection
          // may have missed changes (RF-46).
          if (subscribedOnce) refresh();
          subscribedOnce = true;
        });
    }

    function stop() {
      if (!channel) return;
      void supabase.removeChannel(channel);
      channel = null;
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void start();
      else stop();
    }

    if (document.visibilityState === "visible") void start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      clearTimeout(timer);
      waiting?.();
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [userId, router]);
}
