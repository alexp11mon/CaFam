import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetConnection,
  getThumb,
  putThumb,
  thumbIds,
} from "@/lib/offline/db";
import { syncThumbs } from "@/lib/offline/thumbs";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 035 T4 (RF-29, plan D9).
let memory: ReturnType<typeof memoryIndexedDb>;
beforeEach(() => {
  memory = memoryIndexedDb();
  vi.stubGlobal("indexedDB", memory);
  forgetConnection();
});
afterEach(() => vi.unstubAllGlobals());

const images = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `i${i}`, objectId: `o${i}` }));

describe("syncThumbs", () => {
  it("downloads only the missing ones, 4 at a time", async () => {
    await putThumb("i0", new Blob(["kept"]));
    let running = 0;
    let most = 0;
    const asked: string[] = [];
    const download = vi.fn(async (objectId: string) => {
      asked.push(objectId);
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return new Blob([objectId], { type: "image/jpeg" });
    });

    expect(await syncThumbs(images(10), download)).toEqual({
      added: 9,
      removed: 0,
    });
    expect(asked).not.toContain("o0");
    expect(asked).toHaveLength(9);
    expect(most).toBe(4);
    expect(await getThumb("i5")).toBeInstanceOf(Blob);
  });

  it("deletes the thumbnails no longer in the copy", async () => {
    await putThumb("old", new Blob(["x"]));
    await putThumb("i0", new Blob(["x"]));
    expect(await syncThumbs(images(1), async () => new Blob(["x"]))).toEqual({
      added: 0,
      removed: 1,
    });
    expect(await thumbIds()).toEqual(["i0"]);
  });

  it("skips an image it cannot download and stops when the device is full", async () => {
    const result = await syncThumbs(images(2), async (objectId) =>
      objectId === "o0" ? null : new Blob(["x"]),
    );
    expect(result.added).toBe(1);
    memory.quotaExceeded = true;
    expect(
      await syncThumbs(images(4), async () => new Blob(["x"])),
    ).toMatchObject({ added: 0 });
  });
});
