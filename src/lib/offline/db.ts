// The device's copy, queue and leftovers in IndexedDB (spec 034 plan D2):
// promises over the native API, no business rules. Base `cafam-offline` with
// one store per kind of data, each read and written by key.
import type { OfflineChange, OutboxEntry } from "./outbox";
import { isUsable, SNAPSHOT_FORMAT, type Snapshot } from "./snapshot";

export const DB_NAME = "cafam-offline";
// Version 2 (spec 035): thumbnails, opened images and images added offline.
const VERSION = 2;
export const STORES = [
  "meta",
  "snapshot",
  "outbox",
  "conflicts",
  "rejected",
  "thumbs",
  "images",
  "pending-images",
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

/** An image added offline, reduced as always, waiting to go up (spec 035 RF-32). */
export interface PendingImage {
  localId: string;
  eventId: string;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  bytes: number;
  /** The reservation, saved before uploading so a retry reuses it (D7, RF-41). */
  reservedId: string | null;
}

/** A full image opened with a connection, kept for offline (D10). */
export interface CachedImage {
  blob: Blob;
  usedAt: number;
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

function getOne<T>(store: Store, key: string): Promise<T | undefined> {
  return transact([store], "readonly", (tx) => {
    const request = tx.objectStore(store).get(key);
    return () => request.result as T | undefined;
  });
}

function keysOf(store: Store): Promise<string[]> {
  return transact([store], "readonly", (tx) => {
    const request = tx.objectStore(store).getAllKeys();
    return () => request.result as string[];
  });
}

function putOne(store: Store, key: string, value: unknown): Promise<void> {
  return transact([store], "readwrite", (tx) => {
    tx.objectStore(store).put(value, key);
  });
}

function deleteMany(store: Store, keys: readonly string[]): Promise<void> {
  return transact([store], "readwrite", (tx) => {
    for (const key of keys) tx.objectStore(store).delete(key);
  });
}

/** What the service worker sent with the app closed (spec 035 RF-43). */
export interface BackgroundSync {
  applied: number;
  at: string;
}

const BACKGROUND = "lastBackgroundSync";
export const readBackgroundSync = () =>
  getOne<BackgroundSync>("meta", BACKGROUND);
export const clearBackgroundSync = () => deleteMany("meta", [BACKGROUND]);

export const getThumb = (id: string) => getOne<Blob>("thumbs", id);
export const thumbIds = () => keysOf("thumbs");
export const putThumb = (id: string, blob: Blob) => putOne("thumbs", id, blob);
export const deleteThumbs = (ids: readonly string[]) =>
  deleteMany("thumbs", ids);

export const getCachedImage = (id: string) => getOne<CachedImage>("images", id);
export const putCachedImage = (id: string, image: CachedImage) =>
  putOne("images", id, image);
export const deleteCachedImages = (ids: readonly string[]) =>
  deleteMany("images", ids);
/** Ids and last use of the opened images, to drop the oldest (D10). */
export function cachedImageUses(): Promise<{ id: string; usedAt: number }[]> {
  return transact(["images"], "readonly", (tx) => {
    const keys = tx.objectStore("images").getAllKeys();
    const values = tx.objectStore("images").getAll();
    return () =>
      (keys.result as string[]).map((id, i) => ({
        id,
        usedAt: (values.result[i] as CachedImage).usedAt,
      }));
  });
}

export const getPendingImage = (localId: string) =>
  getOne<PendingImage>("pending-images", localId);
export function pendingImages(): Promise<PendingImage[]> {
  return transact(["pending-images"], "readonly", (tx) => {
    const request = tx.objectStore("pending-images").getAll();
    return () => request.result as PendingImage[];
  });
}
export const deletePendingImages = (localIds: readonly string[]) =>
  deleteMany("pending-images", localIds);

/** Whether a write failed because the device is full (R4). */
export function isQuotaError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "QuotaExceededError"
  );
}

/** Keeps an image added offline; false when the device has no room (R4). */
export async function savePendingImage(image: PendingImage): Promise<boolean> {
  try {
    await putOne("pending-images", image.localId, image);
    return true;
  } catch (error) {
    if (isQuotaError(error)) return false;
    throw error;
  }
}

/** The reservation of a pending image, before its upload (D7). */
export async function setReservedId(
  localId: string,
  reservedId: string | null,
): Promise<void> {
  const image = await getPendingImage(localId);
  if (image) await putOne("pending-images", localId, { ...image, reservedId });
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
