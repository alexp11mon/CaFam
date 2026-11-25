// What another app shared, kept on this device by public/sw.js (spec 047
// RF-10, plan D1). The same database as the worker: a change here goes there.

export const SHARE_DB = "cafam-share";
const STORE = "items";
export const SHARE_TTL_MS = 10 * 60 * 1000;
/** The share whose images wait for an event, in this tab (RF-7). */
export const PENDING_IMAGES_KEY = "cafam-share-images";

export interface SharedItem {
  id: string;
  createdAt: number;
  text: string;
  files: File[];
}

export type SharedKind = "ics" | "images" | "text" | "none";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => (() => T) | void,
): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE], mode);
    const read = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(read ? read() : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const isIcs = (file: File) =>
  file.type === "text/calendar" || /\.ics$/i.test(file.name);
const isImage = (file: File) => file.type.startsWith("image/");

/** What to do with it: an .ics first, then images, then the text (RF-6 to RF-8). */
export function kindOf(item: SharedItem): SharedKind {
  if (item.files.some(isIcs)) return "ics";
  if (item.files.some(isImage)) return "images";
  if (item.text.trim()) return "text";
  return "none";
}

export const icsOf = (item: SharedItem) => item.files.find(isIcs) ?? null;
export const imagesOf = (item: SharedItem) => item.files.filter(isImage);

/** The share, or null when it was used, never existed or waited too long. */
export async function readShared(
  id: string,
  now = Date.now(),
): Promise<SharedItem | null> {
  try {
    const item = await transact<SharedItem | undefined>("readonly", (store) => {
      const request = store.get(id);
      return () => request.result as SharedItem | undefined;
    });
    if (!item) return null;
    if (now - item.createdAt > SHARE_TTL_MS) {
      await dropShared(id);
      return null;
    }
    return item;
  } catch {
    return null;
  }
}

/** Used: it leaves the device (RF-10). */
export async function dropShared(id: string): Promise<void> {
  try {
    await transact("readwrite", (store) => {
      store.delete(id);
    });
  } catch {
    // Nothing to drop; the worker clears it after 10 minutes anyway.
  }
}

/** `?shared=<id>` of the current address, only a uuid. */
export function sharedIdFromLocation(): string | null {
  const id = new URLSearchParams(window.location.search).get("shared");
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
