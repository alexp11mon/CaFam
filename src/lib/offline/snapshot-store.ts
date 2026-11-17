// The device's copy in memory (spec 034 RF-1 to RF-6): what the writes read
// their base from and what the offline app draws. db.ts keeps it on disk;
// React reads it with useSyncExternalStore.
import type { EventWindow } from "@/lib/calendar/event-window";
import * as db from "./db";
import { pendingEvents } from "./overlay";
import { getQueueState } from "./queue-store";
import {
  mergeWindow,
  type OfflineEvent,
  type Snapshot,
  type WindowEvent,
} from "./snapshot";

let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();

export function getSnapshot(): Snapshot | null {
  return snapshot;
}

export function getServerSnapshot(): Snapshot | null {
  return null;
}

export function subscribeSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The copy now in memory; `save` also writes it to the device. */
export async function setSnapshot(
  next: Snapshot | null,
  save = false,
): Promise<void> {
  snapshot = next;
  for (const listener of listeners) listener();
  if (save && next) await db.saveSnapshot(next);
}

/** An event as the user sees it now: the copy with what waits (null if not kept). */
export function findEvent(id: string): OfflineEvent | null {
  if (!snapshot) return null;
  return (
    pendingEvents(snapshot.events, getQueueState().queue).find(
      (event) => event.id === id,
    ) ?? null
  );
}

/** A window the page read again, into the copy (RF-5, RNF-4, plan D9). */
export async function mergeIntoCopy(
  window: EventWindow<WindowEvent>,
): Promise<void> {
  if (!snapshot) return;
  await setSnapshot(
    { ...snapshot, events: mergeWindow(snapshot.events, window) },
    true,
  );
}
