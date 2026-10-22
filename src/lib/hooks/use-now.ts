"use client";

// Current time for the now line and the countdown, shared by every component
// and refreshed every 30 s and when the page comes back to the foreground
// (spec 005 RF-39, RF-47, RF-48; plan D13). useSyncExternalStore instead of
// useEffect + setState: no hydration warning, no lint rule (AGENTS §9).
import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

let latest = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function refresh() {
  latest = Date.now();
  for (const listener of listeners) listener();
}

function onVisibility() {
  if (document.visibilityState !== "hidden") refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(refresh, TICK_MS);
    document.addEventListener("visibilitychange", onVisibility);
    // The module may have been idle for a while: start from the real time.
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

function getSnapshot() {
  if (latest === 0) latest = Date.now();
  return latest;
}

/** Milliseconds since the epoch on the client; null on the server. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
