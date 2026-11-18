import { describe, expect, it, vi } from "vitest";
import type { PendingImage } from "@/lib/offline/db";
import {
  uploadPendingImage,
  type PutResult,
  type UploadDeps,
} from "@/lib/offline/image-upload";

// Spec 035 T8: an image added offline goes up with the reservation saved
// first, its two objects at once, and a retry reuses it (RF-39 to RF-41, D7).

const image = (extra: Partial<PendingImage> = {}): PendingImage => ({
  localId: "local-1",
  eventId: "event-1",
  full: new Blob(["full"], { type: "image/jpeg" }),
  thumb: new Blob(["thumb"], { type: "image/jpeg" }),
  width: 2048,
  height: 1536,
  bytes: 900_000,
  reservedId: null,
  ...extra,
});

const reserved = (id: string) => ({
  status: 200,
  body: {
    id,
    uploads: {
      full: { path: "o/full.jpg", token: "t1", url: "https://s/full" },
      thumb: { path: "o/thumb.jpg", token: "t2", url: "https://s/thumb" },
    },
  },
});

/** A fake server: reservations by id, and what the device keeps. */
function setup(put: UploadDeps["put"]) {
  const log: string[] = [];
  const saved = new Map<string, string | null>();
  let reservations = 0;
  const deps: UploadDeps = {
    post: vi.fn(async (body: Record<string, unknown>) => {
      log.push(`post:${String(body.op)}`);
      if (body.op === "confirm") return { status: 200, body: {} };
      if (body.reservedId) return reserved(String(body.reservedId));
      reservations += 1;
      return reserved(`img-${reservations}`);
    }),
    put: vi.fn(async (url, blob, onProgress) => {
      log.push(`put:${url}`);
      return put(url, blob, onProgress);
    }),
    setReservedId: vi.fn(async (localId, id) => {
      log.push(`save:${id}`);
      saved.set(localId, id);
    }),
  };
  return { deps, log, saved, reservations: () => reservations };
}

describe("uploadPendingImage", () => {
  it("saves the reservation before uploading, then both objects and confirms", async () => {
    const { deps, log } = setup(async () => "ok");
    const progress = vi.fn();
    expect(await uploadPendingImage(image(), deps, progress)).toEqual({
      status: "applied",
    });
    expect(log[0]).toBe("post:reserve");
    expect(log[1]).toBe("save:img-1");
    expect(log.slice(2, 4).sort()).toEqual([
      "put:https://s/full",
      "put:https://s/thumb",
    ]);
    expect(log[4]).toBe("post:confirm");
    expect(deps.post).toHaveBeenLastCalledWith({ op: "confirm", id: "img-1" });
  });

  it("uploads both objects at once, with the progress of the two", async () => {
    let inFlight = 0;
    let most = 0;
    const { deps } = setup(async (_url, blob, onProgress) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      onProgress?.(blob.size, blob.size);
      inFlight -= 1;
      return "ok";
    });
    const progress = vi.fn();
    await uploadPendingImage(image(), deps, progress);
    expect(most).toBe(2);
    expect(progress).toHaveBeenLastCalledWith(1);
  });

  it("after a cut, the retry reuses the reservation: one image in the end", async () => {
    let cut = true;
    const { deps, reservations } = setup(async (): Promise<PutResult> => {
      if (cut) return "network";
      return "ok";
    });
    const first = image();
    expect(await uploadPendingImage(first, deps)).toEqual({ status: "retry" });
    cut = false;
    expect(
      await uploadPendingImage({ ...first, reservedId: "img-1" }, deps),
    ).toEqual({ status: "applied" });
    expect(reservations()).toBe(1);
    expect(deps.post).toHaveBeenCalledWith(
      expect.objectContaining({ op: "reserve", reservedId: "img-1" }),
    );
  });

  it("a reservation purged meanwhile is made again once (D7)", async () => {
    const { deps, saved } = setup(async () => "ok");
    let confirms = 0;
    const post = deps.post;
    deps.post = vi.fn(async (body: Record<string, unknown>) => {
      if (body.op === "confirm" && confirms++ === 0) {
        return { status: 404, body: { error: "gone" } };
      }
      return post(body);
    });
    expect(await uploadPendingImage(image(), deps)).toEqual({
      status: "applied",
    });
    expect(saved.get("local-1")).toBe("img-2");
  });

  it("maps the server's answers", async () => {
    const answers: [number, unknown][] = [
      [401, { unauthenticated: true }],
      [404, { error: "Este evento ya no existe o ya no tienes acceso." }],
      [429, { error: "Este evento ya tiene 10 imágenes." }],
      [503, { error: "retry" }],
    ];
    const results = [];
    for (const [status, body] of answers) {
      const { deps } = setup(async () => "ok");
      deps.post = vi.fn(async () => ({ status, body }));
      results.push(await uploadPendingImage(image(), deps));
    }
    expect(results).toEqual([
      { unauthenticated: true },
      {
        status: "rejected",
        reason: "Este evento ya no existe o ya no tienes acceso.",
      },
      { status: "rejected", reason: "Este evento ya tiene 10 imágenes." },
      { status: "retry" },
    ]);
  });

  it("a network failure while asking is a retry", async () => {
    const { deps } = setup(async () => "ok");
    deps.post = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await uploadPendingImage(image(), deps)).toEqual({
      status: "retry",
    });
  });

  it("skips an object the server says is already uploaded", async () => {
    const { deps, log } = setup(async () => "ok");
    const post = deps.post;
    deps.post = vi.fn(async (body: Record<string, unknown>) => {
      const answer = await post(body);
      if (body.op !== "reserve") return answer;
      const reservedBody = answer.body as {
        uploads: { full: { url: string | null } };
      };
      reservedBody.uploads.full.url = null;
      return answer;
    });
    expect(await uploadPendingImage(image(), deps)).toEqual({
      status: "applied",
    });
    expect(log.filter((line) => line.startsWith("put:"))).toEqual([
      "put:https://s/thumb",
    ]);
  });
});
