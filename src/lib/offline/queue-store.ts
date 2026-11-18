// What waits on this device, in memory and in IndexedDB (spec 034 RF-27,
// RF-30, RF-47, RF-57): the queue, the conflicts and the refused changes.
// React reads it with useSyncExternalStore; db.ts keeps it across reloads.
import { requestBackgroundSync } from "./background";
import * as db from "./db";
import type { Conflict, Rejected } from "./db";
import { enqueue, type OfflineChange, type OutboxEntry } from "./outbox";

/** A change waiting for its account to be connected again (spec 035 RF-7). */
export interface Held {
  changeId: string;
  connectionId: string;
}

export interface QueueState {
  queue: OutboxEntry[];
  conflicts: Conflict[];
  rejected: Rejected[];
  /** From the last send in this tab; not kept on the device. */
  held: Held[];
}

const EMPTY: QueueState = { queue: [], conflicts: [], rejected: [], held: [] };

let state: QueueState = EMPTY;
const listeners = new Set<() => void>();
/** The queue before and after each change, for its "Deshacer" (RF-30). */
const undoable = new Map<
  string,
  { before: OutboxEntry[]; after: OutboxEntry[] }
>();

export function getQueueState(): QueueState {
  return state;
}

export function getServerQueueState(): QueueState {
  return EMPTY;
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(next: Partial<QueueState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

/** Reads what the device held (on start, and after another tab wrote). */
export async function loadQueue(): Promise<void> {
  const { queue, conflicts, rejected } = await db.loadState();
  set({ queue, conflicts, rejected });
}

/** One more change in the queue, merged with the earlier one about the same thing. */
export async function addChange(change: OfflineChange): Promise<string> {
  const changeId = crypto.randomUUID();
  const before = state.queue;
  const after = enqueue(before, {
    changeId,
    createdAt: new Date().toISOString(),
    change,
  });
  undoable.set(changeId, { before, after });
  set({ queue: after });
  await db.saveQueue(after);
  // Sent by the service worker if the app closes first (spec 035 RF-42).
  void requestBackgroundSync();
  return changeId;
}

/**
 * "Deshacer" of a change that is still waiting: the queue goes back to how it
 * was, if nothing was queued or sent since. False if it is too late.
 */
export async function undoChange(changeId: string): Promise<boolean> {
  const step = undoable.get(changeId);
  undoable.delete(changeId);
  if (!step || step.after !== state.queue) return false;
  set({ queue: step.before });
  await db.saveQueue(step.before);
  return true;
}

export async function setQueue(queue: OutboxEntry[]): Promise<void> {
  undoable.clear();
  set({ queue });
  await db.saveQueue(queue);
}

export function setHeld(held: Held[]): void {
  set({ held });
}

export async function addConflict(conflict: Conflict): Promise<void> {
  set({
    conflicts: [
      ...state.conflicts.filter((c) => c.changeId !== conflict.changeId),
      conflict,
    ],
  });
  await db.putConflict(conflict);
}

export async function dropConflict(changeId: string): Promise<void> {
  set({ conflicts: state.conflicts.filter((c) => c.changeId !== changeId) });
  await db.removeConflict(changeId);
}

export async function addRejected(rejected: Rejected): Promise<void> {
  set({
    rejected: [
      ...state.rejected.filter((r) => r.changeId !== rejected.changeId),
      rejected,
    ],
  });
  await db.putRejected(rejected);
}

export async function dropRejected(changeId: string): Promise<void> {
  set({ rejected: state.rejected.filter((r) => r.changeId !== changeId) });
  await db.removeRejected(changeId);
}

/** Nothing left, in memory or on the device (RF-62, RF-64). */
export async function clearQueue(): Promise<void> {
  undoable.clear();
  set(EMPTY);
  await db.clearAll();
}

/** Everything still waiting or asking: what sign-out warns about (RF-61). */
export function waitingCount(current: QueueState = state): number {
  return (
    current.queue.length + current.conflicts.length + current.rejected.length
  );
}
