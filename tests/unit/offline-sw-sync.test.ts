// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetConnection,
  loadState,
  pendingImages,
  readBackgroundSync,
  saveQueue,
  savePendingImage,
} from "@/lib/offline/db";
import type { OfflineChange } from "@/lib/offline/outbox";
import { memoryIndexedDb } from "./memory-indexeddb";
import { fakeServer, flushCases, type Setup } from "./offline-flush-cases";

// Spec 035 T9, plan D4: public/sw.js sends the queue on a "sync" with the
// app closed, and passes the same cases as flush.ts (R1).

const ORIGIN = "https://app.test";
const code = readFileSync("public/sw.js", "utf8");

type SyncListener = (event: {
  tag: string;
  waitUntil: (work: Promise<unknown>) => void;
}) => void;

let idb: ReturnType<typeof memoryIndexedDb>;

beforeEach(() => {
  idb = memoryIndexedDb();
  vi.stubGlobal("indexedDB", idb);
  forgetConnection();
});
afterEach(() => vi.unstubAllGlobals());

/** Loads the worker with a fake network over the fake server. */
function loadWorker(fake: ReturnType<typeof fakeServer>, locks: string[]) {
  const seen = { unauthenticated: false };
  const listeners: Record<string, SyncListener> = {};
  const fetch = async (url: string, init: RequestInit) => {
    if (init.method === "PUT") {
      await fake.put(url);
      return new Response("", { status: 200 });
    }
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (new URL(url).pathname === "/api/offline/apply") {
      const result = await fake.apply(body.change as OfflineChange);
      if ("unauthenticated" in result) {
        seen.unauthenticated = true;
        return Response.json(result, { status: 401 });
      }
      return Response.json(result);
    }
    const answer = await fake.image(body);
    return Response.json(answer.body, { status: answer.status });
  };
  runInNewContext(code, {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, listener: SyncListener) => {
        listeners[type] = listener;
      },
      navigator: {
        locks: {
          request: async (name: string, work: () => Promise<unknown>) => {
            locks.push(name);
            return work();
          },
        },
      },
    },
    indexedDB: idb,
    fetch,
    URL,
    Response,
    Promise,
  });
  /** Fires a "sync"; resolves to whether the browser would try again. */
  const sync = async (tag = "cafam-offline") => {
    let work: Promise<unknown> | undefined;
    listeners.sync!({ tag, waitUntil: (promise) => (work = promise) });
    if (!work) return null;
    return work.then(
      () => false,
      () => true,
    );
  };
  return { sync, seen };
}

async function seed(setup: Setup) {
  await saveQueue(
    setup.queue.map((change, i) => ({
      changeId: `c${i}`,
      createdAt: "2026-11-18T10:00:00Z",
      change,
    })),
  );
  for (const image of setup.images ?? []) await savePendingImage(image);
}

async function runWorker(setup: Setup) {
  await seed(setup);
  const fake = fakeServer(setup);
  const locks: string[] = [];
  const { sync, seen } = loadWorker(fake, locks);
  const retried = await sync();
  const state = await loadState();
  return {
    applied: (await readBackgroundSync())?.applied ?? 0,
    stopped: retried
      ? ("retry" as const)
      : seen.unauthenticated
        ? ("unauthenticated" as const)
        : null,
    sent: fake.sent,
    puts: fake.puts,
    queue: state.queue.map((entry) => entry.change),
    conflicts: state.conflicts.map((conflict) => conflict.change),
    rejected: state.rejected.map(({ change, reason }) => ({ change, reason })),
    pending: (await pendingImages()).map((image) => image.localId),
    locks,
  };
}

flushCases(runWorker);

const note = (id: string): OfflineChange => ({
  type: "note.create",
  id,
  kind: "list",
  calendarId: null,
  fields: { title: id },
});

describe("the service worker's sync (RF-42, RF-43)", () => {
  it("adds what it applied to meta.lastBackgroundSync", async () => {
    await seed({ queue: [note("a")] });
    const first = loadWorker(fakeServer({ queue: [] }), []);
    expect(await first.sync()).toBe(false);
    await seed({ queue: [note("b"), note("c")] });
    expect(await first.sync()).toBe(false);
    expect(await readBackgroundSync()).toEqual({
      applied: 3,
      at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("writes nothing when nothing went", async () => {
    const worker = loadWorker(fakeServer({ queue: [] }), []);
    expect(await worker.sync()).toBe(false);
    expect(await readBackgroundSync()).toBeUndefined();
  });

  it("ignores other tags", async () => {
    await seed({ queue: [note("a")] });
    const fake = fakeServer({ queue: [] });
    expect(await loadWorker(fake, []).sync("other")).toBeNull();
    expect(fake.sent).toEqual([]);
  });

  it("drops the old caches with a new version", () => {
    expect(code).toContain('const CACHE_NAME = "cafam-v7";');
  });
});
