"use client";

import { useSyncExternalStore } from "react";

/** The phone layout of spec 016 (plan D1), the same edge as the `max-tab:` variant. */
export const PHONE_QUERY = "(width <= 768px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(PHONE_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/** For what CSS cannot decide (a portal, a gesture). False on the server. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(PHONE_QUERY).matches ?? false,
    () => false,
  );
}
