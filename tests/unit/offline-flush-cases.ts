import { describe, expect, it } from "vitest";
import type { PendingImage } from "@/lib/offline/db";
import type { SendResult } from "@/lib/offline/flush";
import type { OfflineChange } from "@/lib/offline/outbox";

// Spec 035 T9, plan D4 and R1: the same cases go through flush.ts (the app)
// and through public/sw.js (Background Sync), so the two loops cannot drift.

export interface Setup {
  queue: OfflineChange[];
  /** Images added offline, in "pending-images". */
  images?: PendingImage[];
  /** The answer of /api/offline/apply by the change's id; "applied" by default. */
  apply?: Record<string, SendResult | "network">;
  /** The status of the reservation by the image's localId; 200 by default. */
  reserve?: Record<string, number>;
}

export interface Outcome {
  applied: number;
  stopped: "retry" | "unauthenticated" | null;
  /** The ids of what was sent to /api/offline/apply, in order. */
  sent: string[];
  /** The URLs the images went up to. */
  puts: string[];
  queue: OfflineChange[];
  conflicts: OfflineChange[];
  rejected: { change: OfflineChange; reason: string }[];
  /** The localIds still in "pending-images". */
  pending: string[];
  /** The locks asked for. */
  locks: string[];
}

export type Run = (setup: Setup) => Promise<Outcome>;

/** The id a fake server answers by. */
export function keyOf(change: OfflineChange): string {
  if (change.type === "comment.add") return change.clientId;
  if (change.type === "image.add") return change.localId;
  return (change as { id: string }).id;
}

const noteCreate = (id: string): OfflineChange => ({
  type: "note.create",
  id,
  kind: "list",
  calendarId: null,
  fields: { title: id },
});
const itemAdd = (noteId: string, id: string): OfflineChange => ({
  type: "item.add",
  noteId,
  id,
  text: id,
  position: 0,
  done: false,
});
/** Only its shape matters here: the server is fake. */
const eventDelete = (id: string, title = "Cena") =>
  ({ type: "event.delete", id, base: { title } }) as unknown as OfflineChange;
const imageAdd = (eventId: string, localId: string): OfflineChange => ({
  type: "image.add",
  eventId,
  localId,
});

export const pendingImage = (localId: string): PendingImage => ({
  localId,
  eventId: "e1",
  full: new Blob(["full"], { type: "image/jpeg" }),
  thumb: new Blob(["thumb"], { type: "image/jpeg" }),
  width: 100,
  height: 80,
  bytes: 9,
  reservedId: null,
});

/** The cases both loops must pass. */
export function flushCases(run: Run) {
  describe("the shared sending loop (spec 035 T9)", () => {
    it("sends in order and empties the queue", async () => {
      const outcome = await run({
        queue: [noteCreate("a"), noteCreate("b")],
      });
      expect(outcome).toMatchObject({
        applied: 2,
        stopped: null,
        sent: ["a", "b"],
        queue: [],
      });
    });

    it("sends a note for an event and a due date as they are (spec 048 RF-15)", async () => {
      const forEvent: OfflineChange = {
        ...noteCreate("n1"),
        eventId: "e1_20261210T190000Z",
      } as OfflineChange;
      const due = {
        type: "item.update",
        noteId: "n1",
        id: "i1",
        base: { text: "Pan", done: false, dueDate: null, dueTime: null },
        change: { dueDate: "2026-12-03", dueTime: "09:00" },
      } as OfflineChange;
      // A refused event never takes the note made for it.
      const outcome = await run({
        queue: [eventDelete("e1"), forEvent, due],
        apply: { e1: { status: "rejected", reason: "No existe." } },
      });
      expect(outcome.sent).toEqual(["e1", "n1", "i1"]);
      expect(outcome).toMatchObject({ applied: 2, queue: [] });
    });

    it("keeps a conflict and goes on", async () => {
      const outcome = await run({
        queue: [noteCreate("a"), noteCreate("b")],
        apply: { a: { status: "conflict", server: { title: "Suya" } } },
      });
      expect(outcome).toMatchObject({
        applied: 1,
        sent: ["a", "b"],
        conflicts: [noteCreate("a")],
        queue: [],
      });
    });

    it("a refused change takes what depends on it", async () => {
      const outcome = await run({
        queue: [noteCreate("a"), itemAdd("a", "i1"), noteCreate("b")],
        apply: { a: { status: "rejected", reason: "Máximo de 500 notas." } },
      });
      expect(outcome.sent).toEqual(["a", "b"]);
      expect(outcome.rejected).toEqual([
        { change: noteCreate("a"), reason: "Máximo de 500 notas." },
        { change: itemAdd("a", "i1"), reason: "Máximo de 500 notas." },
      ]);
      expect(outcome.queue).toEqual([]);
    });

    it("held keeps the change and the others of its entity, and goes on (RF-7)", async () => {
      const outcome = await run({
        queue: [
          eventDelete("e1"),
          noteCreate("b"),
          eventDelete("e1", "Otra"),
          noteCreate("c"),
        ],
        apply: { e1: { status: "held", connectionId: "c1" } },
      });
      expect(outcome.sent).toEqual(["e1", "b", "c"]);
      expect(outcome.applied).toBe(2);
      expect(outcome.stopped).toBeNull();
      expect(outcome.queue.map(keyOf)).toEqual(["e1", "e1"]);
      expect(outcome.rejected).toEqual([]);
    });

    it("stops at a retry and keeps the rest", async () => {
      const outcome = await run({
        queue: [noteCreate("a"), noteCreate("b"), noteCreate("c")],
        apply: { b: { status: "retry" } },
      });
      expect(outcome).toMatchObject({
        applied: 1,
        stopped: "retry",
        sent: ["a", "b"],
      });
      expect(outcome.queue.map(keyOf)).toEqual(["b", "c"]);
    });

    it("a network failure is a retry", async () => {
      const outcome = await run({
        queue: [noteCreate("a")],
        apply: { a: "network" },
      });
      expect(outcome.stopped).toBe("retry");
      expect(outcome.queue.map(keyOf)).toEqual(["a"]);
    });

    it("without a session it stops and keeps everything (RF-44)", async () => {
      const outcome = await run({
        queue: [noteCreate("a"), noteCreate("b")],
        apply: { a: { unauthenticated: true } },
      });
      expect(outcome).toMatchObject({ applied: 0, stopped: "unauthenticated" });
      expect(outcome.queue.map(keyOf)).toEqual(["a", "b"]);
    });

    it("images go up by the image route, and leave the device (RF-39)", async () => {
      const outcome = await run({
        queue: [imageAdd("e1", "img-a"), noteCreate("b")],
        images: [pendingImage("img-a")],
      });
      expect(outcome.sent).toEqual(["b"]);
      expect(outcome.puts.sort()).toEqual([
        "https://s/img-a/full",
        "https://s/img-a/thumb",
      ]);
      expect(outcome.applied).toBe(2);
      expect(outcome.queue).toEqual([]);
      expect(outcome.pending).toEqual([]);
    });

    it("a refused image keeps its bytes to be downloaded (RF-40)", async () => {
      const outcome = await run({
        queue: [imageAdd("e1", "img-a")],
        images: [pendingImage("img-a")],
        reserve: { "img-a": 429 },
      });
      expect(outcome.rejected).toEqual([
        {
          change: imageAdd("e1", "img-a"),
          reason: "Este evento ya tiene 10 imágenes.",
        },
      ]);
      expect(outcome.pending).toEqual(["img-a"]);
    });

    it("an image whose bytes are gone is dropped", async () => {
      const outcome = await run({ queue: [imageAdd("e1", "img-a")] });
      expect(outcome.queue).toEqual([]);
      expect(outcome.rejected).toEqual([]);
      expect(outcome.puts).toEqual([]);
    });

    it("runs under the device's lock (RF-45)", async () => {
      const outcome = await run({ queue: [noteCreate("a")] });
      expect(outcome.locks).toEqual(["cafam-offline-flush"]);
    });
  });
}

/** A fake server for both loops: the two routes and the signed URLs. */
export function fakeServer(setup: Setup) {
  const sent: string[] = [];
  const puts: string[] = [];
  return {
    sent,
    puts,
    /** /api/offline/apply. A thrown TypeError is a network failure. */
    async apply(change: OfflineChange): Promise<SendResult> {
      const key = keyOf(change);
      sent.push(key);
      const answer = setup.apply?.[key] ?? { status: "applied" };
      if (answer === "network") throw new TypeError("Failed to fetch");
      return answer;
    },
    /** /api/offline/image, with the reservation named after the localId. */
    async image(
      body: Record<string, unknown>,
    ): Promise<{ status: number; body: unknown }> {
      if (body.op === "confirm") return { status: 200, body: {} };
      const localId = (setup.images ?? []).find(
        (image) => image.eventId === body.eventId,
      )?.localId;
      const status = setup.reserve?.[localId ?? ""] ?? 200;
      if (status === 429) {
        return { status, body: { error: "Este evento ya tiene 10 imágenes." } };
      }
      return {
        status,
        body: {
          id: `r-${localId}`,
          uploads: {
            full: { path: "p", token: "t", url: `https://s/${localId}/full` },
            thumb: { path: "p", token: "t", url: `https://s/${localId}/thumb` },
          },
        },
      };
    },
    async put(url: string): Promise<void> {
      puts.push(url);
    },
  };
}
