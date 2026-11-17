import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimFor,
  clearAll,
  DB_NAME,
  forgetConnection,
  loadState,
  putConflict,
  putRejected,
  readMeta,
  removeConflict,
  removeRejected,
  saveQueue,
  saveSnapshot,
  STORES,
} from "@/lib/offline/db";
import type { OutboxEntry } from "@/lib/offline/outbox";
import type { Snapshot } from "@/lib/offline/snapshot";

// Spec 034 T6, plan R9: a minimal IndexedDB in memory, written here (no
// fake-indexeddb, which would be a new dependency).
type Request = {
  result?: unknown;
  error: null;
  onsuccess?: () => void;
  onerror?: () => void;
  onupgradeneeded?: () => void;
};

function memoryIndexedDb() {
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

let memory: ReturnType<typeof memoryIndexedDb>;
beforeEach(() => {
  memory = memoryIndexedDb();
  vi.stubGlobal("indexedDB", memory);
  forgetConnection();
});
afterEach(() => vi.unstubAllGlobals());

const snapshot = (userId: string, extra: Partial<Snapshot> = {}) =>
  ({
    format: 1,
    userId,
    savedAt: "2026-11-17T10:00:00.000Z",
    today: "2026-11-17",
    range: { from: "2026-10-17", to: "2027-02-17" },
    events: [],
    notes: [],
    ...extra,
  }) as unknown as Snapshot;

const entry: OutboxEntry = {
  changeId: "c1",
  createdAt: "2026-11-17T10:05:00.000Z",
  change: {
    type: "item.move",
    noteId: "n1",
    positions: [{ id: "i1", position: 0 }],
  },
};

describe("the offline database (RF-27, RF-57)", () => {
  it("creates the five stores of cafam-offline and starts empty", async () => {
    expect(await loadState()).toEqual({
      snapshot: null,
      queue: [],
      conflicts: [],
      rejected: [],
    });
    expect([...memory.databases.get(DB_NAME)!.keys()]).toEqual([...STORES]);
  });

  it("keeps the copy with its meta, the queue, conflicts and rejected changes", async () => {
    await saveSnapshot(snapshot("ana"));
    await saveQueue([entry]);
    await putConflict({ changeId: "c2", change: entry.change, server: null });
    await putRejected({ changeId: "c3", change: entry.change, reason: "No" });

    forgetConnection(); // as after closing the app
    const state = await loadState();
    expect(state.snapshot).toMatchObject({ userId: "ana" });
    expect(state.queue).toEqual([entry]);
    expect(state.conflicts.map((c) => c.changeId)).toEqual(["c2"]);
    expect(state.rejected.map((r) => r.reason)).toEqual(["No"]);
    expect(await readMeta()).toEqual({
      format: 1,
      userId: "ana",
      savedAt: "2026-11-17T10:00:00.000Z",
    });

    await removeConflict("c2");
    await removeRejected("c3");
    expect(await loadState()).toMatchObject({ conflicts: [], rejected: [] });
  });

  it("leaves out a copy of another format but keeps the queue (R1)", async () => {
    await saveSnapshot(snapshot("ana", { format: 0 } as Partial<Snapshot>));
    await saveQueue([entry]);
    expect(await loadState()).toMatchObject({ snapshot: null, queue: [entry] });
  });

  it("deletes everything (RF-62)", async () => {
    await saveSnapshot(snapshot("ana"));
    await saveQueue([entry]);
    await clearAll();
    expect(await loadState()).toEqual({
      snapshot: null,
      queue: [],
      conflicts: [],
      rejected: [],
    });
    expect(await readMeta()).toBeUndefined();
  });

  it("another account deletes what the device held (RF-64)", async () => {
    await saveSnapshot(snapshot("ana"));
    await saveQueue([entry]);
    expect(await claimFor("ana")).toBe(false);
    expect((await loadState()).queue).toEqual([entry]);
    expect(await claimFor("luis")).toBe(true);
    expect(await loadState()).toMatchObject({ snapshot: null, queue: [] });
  });
});
