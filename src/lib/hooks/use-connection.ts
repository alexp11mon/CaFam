"use client";

import { useSyncExternalStore } from "react";
import { isOnline, subscribe } from "@/lib/offline/connection";

/** Whether the server can be reached now (spec 034 RF-9, RF-18). */
export function useConnection(): boolean {
  // The server always renders the online app.
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
