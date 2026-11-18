import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetConnection, loadState } from "@/lib/offline/db";
import {
  isOnline,
  resetConnection,
  startWatching,
} from "@/lib/offline/connection";
import type { OfflineChange } from "@/lib/offline/outbox";
import {
  clearQueue,
  getQueueState,
  undoChange,
} from "@/lib/offline/queue-store";
import { withOutbox } from "@/lib/offline/with-outbox";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 034 T7: a write goes to the server, or waits in the queue (RF-19,
// RF-27, RF-30).
const move = (position: number): OfflineChange => ({
  type: "item.move",
  noteId: "n1",
  positions: [{ id: "i1", position }],
});

let stop: () => void = () => {};
beforeEach(async () => {
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  forgetConnection();
  stop = startWatching();
  await clearQueue();
});
afterEach(() => {
  stop();
  resetConnection();
  vi.unstubAllGlobals();
});

describe("withOutbox", () => {
  it("online, it calls the action and queues nothing", async () => {
    const write = vi.fn(async () => ({ ok: true }));
    expect(await withOutbox(write, move(1))).toEqual({ ok: true });
    expect(write).toHaveBeenCalledOnce();
    expect(getQueueState().queue).toEqual([]);
  });

  it("offline, it queues and saves the change, and answers a success with its undo", async () => {
    window.dispatchEvent(new Event("offline"));
    const write = vi.fn(async () => ({ ok: true }));
    const result = await withOutbox(write, move(1));
    expect(write).not.toHaveBeenCalled();
    expect(result).toEqual({
      offline: true,
      undo: { kind: "offline", changeId: expect.any(String) },
    });
    expect(getQueueState().queue.map((e) => e.change)).toEqual([move(1)]);
    forgetConnection();
    expect((await loadState()).queue.map((e) => e.change)).toEqual([move(1)]);
  });

  it("a write that fails by the network is queued, and the app goes offline", async () => {
    const result = await withOutbox(async () => {
      throw new TypeError("Failed to fetch");
    }, move(2));
    expect(result).toMatchObject({ offline: true });
    expect(isOnline()).toBe(false);
    expect(getQueueState().queue).toHaveLength(1);
  });

  it("an error of the server is not queued", async () => {
    await expect(
      withOutbox(async () => {
        throw new Error("boom");
      }, move(2)),
    ).rejects.toThrow("boom");
    expect(getQueueState().queue).toEqual([]);
  });

  it("a write that needs the network (no change) is never queued", async () => {
    window.dispatchEvent(new Event("offline"));
    const write = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(withOutbox(write, null)).rejects.toThrow(TypeError);
    expect(getQueueState().queue).toEqual([]);
  });

  it("with older changes waiting, a new one waits behind them (RF-40)", async () => {
    window.dispatchEvent(new Event("offline"));
    await withOutbox(async () => 0, move(1));
    await withOutbox(async () => 0, {
      type: "note.delete",
      id: "n2",
      base: {
        title: "",
        body: "",
        color: null,
        pinned: false,
        archived: false,
        dueDate: null,
      },
    });
    expect(getQueueState().queue).toHaveLength(2);
  });

  it("undo puts the queue back as it was, while nothing came after (RF-30)", async () => {
    window.dispatchEvent(new Event("offline"));
    const first = await withOutbox(async () => 0, move(1));
    const second = await withOutbox(async () => 0, move(5));
    // Both orders of the same list are one change (RF-42).
    expect(getQueueState().queue.map((e) => e.change)).toEqual([move(5)]);

    if (typeof second !== "object" || typeof first !== "object") throw 0;
    expect(await undoChange(second.undo.changeId)).toBe(true);
    expect(getQueueState().queue.map((e) => e.change)).toEqual([move(1)]);
    expect(await undoChange(second.undo.changeId)).toBe(false);
    expect(await undoChange(first.undo.changeId)).toBe(true);
    expect(getQueueState().queue).toEqual([]);
  });
});
