import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetConnection,
  loadState,
  pendingImages,
  savePendingImage,
  setReservedId,
} from "@/lib/offline/db";
import { resetConnection } from "@/lib/offline/connection";
import { flush, type Send, type SendResult } from "@/lib/offline/flush";
import type { OfflineChange } from "@/lib/offline/outbox";
import {
  addChange,
  clearQueue,
  getQueueState,
  setQueue,
} from "@/lib/offline/queue-store";
import { memoryIndexedDb } from "./memory-indexeddb";
import { fakeServer, flushCases, type Setup } from "./offline-flush-cases";

// Spec 034 T7: sending the queue when the network is back (RF-38 to RF-49,
// RF-56, RF-63).
const fields = {
  title: "",
  body: "",
  color: null,
  pinned: false,
  archived: false,
  dueDate: null,
};
const noteCreate = (id: string): OfflineChange => ({
  type: "note.create",
  id,
  kind: "list",
  calendarId: null,
  fields: { title: id },
});
const noteUpdate = (id: string, title: string): OfflineChange => ({
  type: "note.update",
  id,
  base: fields,
  fields: { title },
});
const itemAdd = (noteId: string, id: string): OfflineChange => ({
  type: "item.add",
  noteId,
  id,
  text: id,
  position: 0,
  done: false,
});

/** A server that answers each change by its id, "applied" by default. */
function server(answers: Record<string, SendResult> = {}) {
  const sent: string[] = [];
  const send: Send = vi.fn(async (change) => {
    const id = (change as { id: string }).id;
    sent.push(id);
    return answers[id] ?? { status: "applied" };
  });
  return { send, sent };
}

beforeEach(async () => {
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  forgetConnection();
  await clearQueue();
});
afterEach(() => {
  resetConnection();
  vi.unstubAllGlobals();
});

describe("flush", () => {
  it("sends in order, empties the queue and says how many went (RF-40, RF-44)", async () => {
    await addChange(noteCreate("a"));
    await addChange(noteCreate("b"));
    await addChange(noteCreate("c"));
    const { send, sent } = server();
    const notify = vi.fn();
    expect(await flush(send, notify)).toEqual({ applied: 3, stopped: null });
    expect(sent).toEqual(["a", "b", "c"]);
    expect(getQueueState().queue).toEqual([]);
    expect(notify).toHaveBeenCalledExactlyOnceWith("3 cambios sincronizados");
    expect((await loadState()).queue).toEqual([]);
  });

  it("a conflict is kept to be resolved, and the rest goes on (RF-56, RF-57)", async () => {
    await addChange(noteUpdate("a", "Mía"));
    await addChange(noteCreate("b"));
    const { send, sent } = server({
      a: { status: "conflict", server: { title: "Suya" } },
    });
    expect(await flush(send)).toEqual({ applied: 1, stopped: null });
    expect(sent).toEqual(["a", "b"]);
    expect(getQueueState().conflicts).toEqual([
      expect.objectContaining({
        change: noteUpdate("a", "Mía"),
        server: { title: "Suya" },
      }),
    ]);
    expect((await loadState()).conflicts).toHaveLength(1);
  });

  it("a refused change takes what depends on it to the refused list (RF-47, RF-49)", async () => {
    await addChange(noteCreate("a"));
    await addChange(itemAdd("a", "i1"));
    await addChange(noteCreate("b"));
    const { send, sent } = server({
      a: { status: "rejected", reason: "Has llegado al máximo de 500 notas." },
    });
    expect(await flush(send)).toEqual({ applied: 1, stopped: null });
    expect(sent).toEqual(["a", "b"]);
    expect(getQueueState().rejected.map((r) => r.change)).toEqual([
      noteCreate("a"),
      itemAdd("a", "i1"),
    ]);
    expect(getQueueState().rejected[1]?.reason).toMatch(/500 notas/);
  });

  it("stops at a change to retry and keeps it with the rest (RF-46)", async () => {
    await addChange(noteCreate("a"));
    await addChange(noteCreate("b"));
    await addChange(noteCreate("c"));
    const { send, sent } = server({ b: { status: "retry" } });
    const notify = vi.fn();
    expect(await flush(send, notify)).toEqual({ applied: 1, stopped: "retry" });
    expect(sent).toEqual(["a", "b"]);
    expect(getQueueState().queue.map((e) => e.change)).toEqual([
      noteCreate("b"),
      noteCreate("c"),
    ]);
    expect(notify).toHaveBeenCalledWith("1 cambio sincronizado");
  });

  it("a network failure while sending is a retry", async () => {
    await addChange(noteCreate("a"));
    const send: Send = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await flush(send)).toEqual({ applied: 0, stopped: "retry" });
    expect(getQueueState().queue).toHaveLength(1);
  });

  it("with no session it stops and keeps everything (RF-63)", async () => {
    await addChange(noteCreate("a"));
    await addChange(noteCreate("b"));
    const { send } = server({ a: { unauthenticated: true } });
    expect(await flush(send)).toEqual({
      applied: 0,
      stopped: "unauthenticated",
    });
    expect(getQueueState().queue).toHaveLength(2);
  });

  it("is one run at a time: a second call gets the first one (R4)", async () => {
    await addChange(noteCreate("a"));
    let answer: (result: SendResult) => void = () => {};
    const send: Send = vi.fn(
      () => new Promise<SendResult>((resolve) => (answer = resolve)),
    );
    const first = flush(send);
    const second = flush(send);
    expect(second).toBe(first);
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    answer({ status: "applied" });
    expect(await first).toEqual({ applied: 1, stopped: null });
    expect(send).toHaveBeenCalledOnce();
  });
});

/** The shared cases through flush.ts (spec 035 T9, plan D4). */
async function runFlush(setup: Setup) {
  await setQueue(
    setup.queue.map((change, i) => ({
      changeId: `c${i}`,
      createdAt: "2026-11-18T10:00:00Z",
      change,
    })),
  );
  for (const image of setup.images ?? []) await savePendingImage(image);
  const fake = fakeServer(setup);
  const locks: string[] = [];
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (name: string, work: () => Promise<unknown>) => {
        locks.push(name);
        return work();
      },
    },
  });
  try {
    const result = await flush(fake.apply, undefined, {
      post: fake.image,
      put: async (url) => {
        await fake.put(url);
        return "ok";
      },
      setReservedId,
    });
    const state = await loadState();
    return {
      ...result,
      sent: fake.sent,
      puts: fake.puts,
      queue: state.queue.map((entry) => entry.change),
      conflicts: state.conflicts.map((conflict) => conflict.change),
      rejected: state.rejected.map(({ change, reason }) => ({
        change,
        reason,
      })),
      pending: (await pendingImages()).map((image) => image.localId),
      locks,
    };
  } finally {
    Reflect.deleteProperty(navigator, "locks");
  }
}

flushCases(runFlush);

describe("held accounts (spec 035 RF-7)", () => {
  it("says which changes wait for which account", async () => {
    await addChange(noteCreate("a"));
    await addChange(noteCreate("b"));
    const { send } = server({ a: { status: "held", connectionId: "c1" } });
    expect(await flush(send)).toEqual({ applied: 1, stopped: null });
    expect(getQueueState().held).toEqual([
      { changeId: getQueueState().queue[0]!.changeId, connectionId: "c1" },
    ]);
  });
});
