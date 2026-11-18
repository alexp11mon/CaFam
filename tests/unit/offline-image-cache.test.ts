import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetConnection } from "@/lib/offline/db";
import {
  cachedImage,
  MAX_CACHED_IMAGES,
  rememberImage,
} from "@/lib/offline/image-cache";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 035 T4 (RF-31, plan D10).
let memory: ReturnType<typeof memoryIndexedDb>;
beforeEach(() => {
  memory = memoryIndexedDb();
  vi.stubGlobal("indexedDB", memory);
  forgetConnection();
});
afterEach(() => vi.unstubAllGlobals());

describe("the cache of opened images", () => {
  it("keeps at most 30: the one used longest ago goes", async () => {
    expect(MAX_CACHED_IMAGES).toBe(30);
    for (let i = 0; i < 30; i += 1) {
      await rememberImage(`i${i}`, new Blob([`${i}`]), 1000 + i);
    }
    // Opening the first again makes it the newest.
    expect(await cachedImage("i0", 5000)).toBeInstanceOf(Blob);
    await rememberImage("i30", new Blob(["30"]), 6000);

    expect(await cachedImage("i1")).toBeNull();
    expect(await cachedImage("i0")).toBeInstanceOf(Blob);
    expect(await cachedImage("i30")).toBeInstanceOf(Blob);
  });

  it("gives null for an image it never opened", async () => {
    expect(await cachedImage("nope")).toBeNull();
  });

  it("skips an image when the device is full (R4)", async () => {
    memory.quotaExceeded = true;
    await expect(rememberImage("i0", new Blob(["x"]))).resolves.toBeUndefined();
    memory.quotaExceeded = false;
    expect(await cachedImage("i0")).toBeNull();
  });
});
