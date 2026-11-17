// Spec 034 T6, plan R9: a minimal IndexedDB in memory, written here (no
// fake-indexeddb, which would be a new dependency).
type Request = {
  result?: unknown;
  error: null;
  onsuccess?: () => void;
  onerror?: () => void;
  onupgradeneeded?: () => void;
};

export function memoryIndexedDb() {
  const databases = new Map<string, Map<string, Map<IDBValidKey, unknown>>>();
  const later = (fn: () => void) => setTimeout(fn, 0);
  return {
    databases,
    open(name: string) {
      const request: Request = { error: null };
      later(() => {
        const isNew = !databases.has(name);
        const stores = databases.get(name) ?? new Map();
        databases.set(name, stores);
        const db = {
          objectStoreNames: { contains: (store: string) => stores.has(store) },
          createObjectStore: (store: string) => stores.set(store, new Map()),
          transaction(names: string[]) {
            const tx: {
              oncomplete?: () => void;
              onerror?: () => void;
              onabort?: () => void;
              error: null;
              objectStore: (store: string) => unknown;
            } = {
              error: null,
              objectStore(store: string) {
                if (!names.includes(store))
                  throw new Error(`not in tx: ${store}`);
                const rows = stores.get(store)!;
                const done = (result?: unknown) => ({ result, error: null });
                return {
                  get: (key: IDBValidKey) =>
                    done(structuredClone(rows.get(key))),
                  getAll: () => done(structuredClone([...rows.values()])),
                  put: (value: unknown, key: IDBValidKey) =>
                    done(rows.set(key, structuredClone(value)) && key),
                  delete: (key: IDBValidKey) =>
                    done(rows.delete(key) && undefined),
                  clear: () => done(rows.clear()),
                };
              },
            };
            later(() => tx.oncomplete?.());
            return tx;
          },
        };
        request.result = db;
        if (isNew) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}
