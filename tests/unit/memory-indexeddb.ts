// Spec 034 T6, plan R9: a minimal IndexedDB in memory, written here (no
// fake-indexeddb, which would be a new dependency). Spec 035 T4: versions
// with upgrades, Blobs kept as they are, getAllKeys and a full disk.
type Request = {
  result?: unknown;
  error: null;
  onsuccess?: () => void;
  onerror?: () => void;
  onupgradeneeded?: () => void;
};

/** A copy like structuredClone, but Blobs pass as they are (jsdom cannot clone them). */
function clone<T>(value: T): T {
  if (value instanceof Blob || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) return value.map(clone) as T;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, clone(item)]),
  ) as T;
}

export function memoryIndexedDb() {
  const databases = new Map<string, Map<string, Map<IDBValidKey, unknown>>>();
  const versions = new Map<string, number>();
  const later = (fn: () => void) => setTimeout(fn, 0);
  const state = {
    databases,
    versions,
    /** Set to make the next write fail as a full disk does (spec 035 R4). */
    quotaExceeded: false,
    open(name: string, version = 1) {
      const request: Request = { error: null };
      later(() => {
        const upgrade = (versions.get(name) ?? 0) < version;
        versions.set(name, Math.max(version, versions.get(name) ?? 0));
        const stores = databases.get(name) ?? new Map();
        databases.set(name, stores);
        const db = {
          objectStoreNames: { contains: (store: string) => stores.has(store) },
          createObjectStore: (store: string) => stores.set(store, new Map()),
          transaction(names: string[]) {
            let failed = false;
            const tx: {
              oncomplete?: () => void;
              onerror?: () => void;
              onabort?: () => void;
              error: unknown;
              objectStore: (store: string) => unknown;
            } = {
              error: null,
              objectStore(store: string) {
                if (!names.includes(store))
                  throw new Error(`not in tx: ${store}`);
                const rows = stores.get(store)!;
                const done = (result?: unknown) => ({ result, error: null });
                return {
                  get: (key: IDBValidKey) => done(clone(rows.get(key))),
                  getAll: () => done(clone([...rows.values()])),
                  getAllKeys: () => done([...rows.keys()]),
                  put: (value: unknown, key: IDBValidKey) => {
                    if (state.quotaExceeded) {
                      failed = true;
                      return done();
                    }
                    return done(rows.set(key, clone(value)) && key);
                  },
                  delete: (key: IDBValidKey) =>
                    done(rows.delete(key) && undefined),
                  clear: () => done(rows.clear()),
                };
              },
            };
            later(() => {
              if (failed) {
                tx.error = new DOMException("Full", "QuotaExceededError");
                tx.onabort?.();
              } else {
                tx.oncomplete?.();
              }
            });
            return tx;
          },
        };
        request.result = db;
        if (upgrade) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  return state;
}
