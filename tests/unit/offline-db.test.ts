import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimFor,
  clearAll,
  DB_NAME,
  getPendingImage,
  getThumb,
  pendingImages,
  putCachedImage,
  putThumb,
  savePendingImage,
  setReservedId,
  type PendingImage,
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
import { SNAPSHOT_FORMAT, type Snapshot } from "@/lib/offline/snapshot";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 034 T6, plan R9.
let memory: ReturnType<typeof memoryIndexedDb>;
beforeEach(() => {
  memory = memoryIndexedDb();
  vi.stubGlobal("indexedDB", memory);
  forgetConnection();
});
afterEach(() => vi.unstubAllGlobals());

const snapshot = (userId: string, extra: Partial<Snapshot> = {}) =>
  ({
    format: SNAPSHOT_FORMAT,
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
  it("creates the stores of cafam-offline and starts empty", async () => {
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
      format: 2,
      userId: "ana",
      savedAt: "2026-11-17T10:00:00.000Z",
    });

    await removeConflict("c2");
    await removeRejected("c3");
    expect(await loadState()).toMatchObject({ conflicts: [], rejected: [] });
  });

  it("leaves out a copy of format 1 but keeps the queue (R1, spec 035 T3)", async () => {
    await saveSnapshot(snapshot("ana", { format: 1 } as Partial<Snapshot>));
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

// Spec 035 T4: version 2 with thumbnails, opened images and pending images.
const pending = (localId: string): PendingImage => ({
  localId,
  eventId: "e1",
  full: new Blob(["full"], { type: "image/jpeg" }),
  thumb: new Blob(["thumb"], { type: "image/jpeg" }),
  width: 2048,
  height: 1536,
  bytes: 4,
  reservedId: null,
});

describe("the offline database, version 2 (spec 035)", () => {
  it("upgrades from version 1 keeping the queue (RF-47)", async () => {
    await new Promise<void>((resolve) => {
      const request = memory.open(DB_NAME, 1) as {
        result: IDBDatabase;
        onupgradeneeded?: () => void;
        onsuccess?: () => void;
      };
      request.onupgradeneeded = () => {
        for (const store of [
          "meta",
          "snapshot",
          "outbox",
          "conflicts",
          "rejected",
        ]) {
          request.result.createObjectStore(store);
        }
      };
      request.onsuccess = () => {
        const tx = request.result.transaction(["outbox"], "readwrite");
        tx.objectStore("outbox").put([entry], "queue");
        tx.oncomplete = () => resolve();
      };
    });
    expect(memory.databases.get(DB_NAME)!.has("thumbs")).toBe(false);

    expect((await loadState()).queue).toEqual([entry]);
    expect([...memory.databases.get(DB_NAME)!.keys()].sort()).toEqual(
      [...STORES].sort(),
    );
    expect(memory.versions.get(DB_NAME)).toBe(2);
  });

  it("keeps a pending image with its reservation (RF-32, D7)", async () => {
    expect(await savePendingImage(pending("l1"))).toBe(true);
    await setReservedId("l1", "img-9");
    expect(await getPendingImage("l1")).toMatchObject({
      eventId: "e1",
      reservedId: "img-9",
      width: 2048,
    });
    expect((await getPendingImage("l1"))!.full).toBeInstanceOf(Blob);
    expect(await pendingImages()).toHaveLength(1);
  });

  it("says when the device is full and keeps nothing (R4)", async () => {
    memory.quotaExceeded = true;
    expect(await savePendingImage(pending("l2"))).toBe(false);
    memory.quotaExceeded = false;
    expect(await getPendingImage("l2")).toBeUndefined();
  });

  it("clearAll empties the new stores too (RF-47)", async () => {
    await putThumb("i1", new Blob(["t"]));
    await putCachedImage("i1", { blob: new Blob(["f"]), usedAt: 1 });
    await savePendingImage(pending("l1"));
    await clearAll();
    expect(await getThumb("i1")).toBeUndefined();
    expect(await pendingImages()).toEqual([]);
    for (const store of ["thumbs", "images", "pending-images"]) {
      expect(memory.databases.get(DB_NAME)!.get(store)!.size).toBe(0);
    }
  });
});
