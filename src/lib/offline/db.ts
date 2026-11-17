// The device's copy, queue and leftovers in IndexedDB (spec 034 plan D2):
// promises over the native API, no business rules. Base `cafam-offline` with
// one store per kind of data, each read and written by key.
import type { OfflineChange, OutboxEntry } from "./outbox";
import { isUsable, SNAPSHOT_FORMAT, type Snapshot } from "./snapshot";

export const DB_NAME = "cafam-offline";
const VERSION = 1;
export const STORES = [
  "meta",
  "snapshot",
  "outbox",
  "conflicts",
  "rejected",
] as const;
type Store = (typeof STORES)[number];

/** A change the server answered with someone else's version (RF-50 to RF-55). */
export interface Conflict {
  changeId: string;
  change: OfflineChange;
  /** The server's version now; null when another person deleted it. */
  server: Record<string, unknown> | null;
}

/** A change the server refused, kept to be read or copied (RF-47, RF-48). */
export interface Rejected {
  changeId: string;
  change: OfflineChange;
  reason: string;
}

export interface Meta {
  format: number;
  userId: string;
  savedAt: string;
}

export interface OfflineState {
  snapshot: Snapshot | null;
  queue: OutboxEntry[];
  conflicts: Conflict[];
  rejected: Rejected[];
}

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      for (const store of STORES) {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

/** Forgets the open connection (tests swap the IndexedDB they use). */
export function forgetConnection() {
  opening = null;
}

async function transact<T>(
  stores: readonly Store[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => (() => T) | void,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...stores], mode);
    const result = work(tx);
    tx.oncomplete = () => resolve(result ? result() : (undefined as T));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const QUEUE = "queue";
const ONE = "one";

/** Everything the device holds; a copy of another format is left out (R1). */
export function loadState(): Promise<OfflineState> {
  return transact([...STORES], "readonly", (tx) => {
    const snapshot = tx.objectStore("snapshot").get(ONE);
    const queue = tx.objectStore("outbox").get(QUEUE);
    const conflicts = tx.objectStore("conflicts").getAll();
    const rejected = tx.objectStore("rejected").getAll();
    return () => ({
      snapshot: isUsable(snapshot.result) ? snapshot.result : null,
      queue: (queue.result as OutboxEntry[] | undefined) ?? [],
      conflicts: conflicts.result as Conflict[],
      rejected: rejected.result as Rejected[],
    });
  });
}

export function readMeta(): Promise<Meta | undefined> {
  return transact(["meta"], "readonly", (tx) => {
    const request = tx.objectStore("meta").get(ONE);
    return () => request.result as Meta | undefined;
  });
}

/** The new copy, with its meta, in one transaction (RF-1 to RF-4). */
export function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const meta: Meta = {
    format: SNAPSHOT_FORMAT,
    userId: snapshot.userId,
    savedAt: snapshot.savedAt,
  };
  return transact(["meta", "snapshot"], "readwrite", (tx) => {
    tx.objectStore("meta").put(meta, ONE);
    tx.objectStore("snapshot").put(snapshot, ONE);
  });
}

/** The whole queue, as `enqueue` leaves it (RF-27, RF-42). */
export function saveQueue(queue: OutboxEntry[]): Promise<void> {
  return transact(["outbox"], "readwrite", (tx) => {
    tx.objectStore("outbox").put(queue, QUEUE);
  });
}

export function putConflict(conflict: Conflict): Promise<void> {
  return transact(["conflicts"], "readwrite", (tx) => {
    tx.objectStore("conflicts").put(conflict, conflict.changeId);
  });
}

export function removeConflict(changeId: string): Promise<void> {
  return transact(["conflicts"], "readwrite", (tx) => {
    tx.objectStore("conflicts").delete(changeId);
  });
}

export function putRejected(rejected: Rejected): Promise<void> {
  return transact(["rejected"], "readwrite", (tx) => {
    tx.objectStore("rejected").put(rejected, rejected.changeId);
  });
}

export function removeRejected(changeId: string): Promise<void> {
  return transact(["rejected"], "readwrite", (tx) => {
    tx.objectStore("rejected").delete(changeId);
  });
}

/** Nothing of the user stays on the device (RF-62, RF-65). */
export function clearAll(): Promise<void> {
  return transact([...STORES], "readwrite", (tx) => {
    for (const store of STORES) tx.objectStore(store).clear();
  });
}

/**
 * The device belongs to `userId` from now on: another account's data is
 * deleted first (RF-64). True when something was deleted.
 */
export async function claimFor(userId: string): Promise<boolean> {
  const meta = await readMeta();
  if (!meta || meta.userId === userId) return false;
  await clearAll();
  return true;
}
