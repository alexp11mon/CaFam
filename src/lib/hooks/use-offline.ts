"use client";

import { useSyncExternalStore } from "react";
import {
  getQueueState,
  getServerQueueState,
  subscribeQueue,
  type QueueState,
} from "@/lib/offline/queue-store";
import type { Snapshot } from "@/lib/offline/snapshot";
import {
  getServerSnapshot,
  getSnapshot,
  subscribeSnapshot,
} from "@/lib/offline/snapshot-store";

/** What waits on this device: queue, conflicts and refused changes (spec 034). */
export function useOfflineQueue(): QueueState {
  return useSyncExternalStore(
    subscribeQueue,
    getQueueState,
    getServerQueueState,
  );
}

/** The device's copy, or null (spec 034 RF-1 to RF-3). */
export function useOfflineSnapshot(): Snapshot | null {
  return useSyncExternalStore(
    subscribeSnapshot,
    getSnapshot,
    getServerSnapshot,
  );
}
