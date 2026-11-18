import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestBackgroundSync, SYNC_TAG } from "@/lib/offline/background";
import { forgetConnection } from "@/lib/offline/db";
import { addChange, clearQueue } from "@/lib/offline/queue-store";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 035 T9: Background Sync only where the browser has it (RF-42, RF-46).

function worker(registration: unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: async () => registration },
  });
}

beforeEach(async () => {
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  forgetConnection();
  await clearQueue();
});
afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.unstubAllGlobals();
});

describe("requestBackgroundSync", () => {
  it("registers the tag when the browser has Background Sync", async () => {
    const register = vi.fn(async () => {});
    worker({ sync: { register } });
    expect(await requestBackgroundSync()).toBe(true);
    expect(register).toHaveBeenCalledExactlyOnceWith("cafam-offline");
    expect(SYNC_TAG).toBe("cafam-offline");
  });

  it("does nothing without a worker or without Background Sync (Safari)", async () => {
    expect(await requestBackgroundSync()).toBe(false);
    worker(undefined);
    expect(await requestBackgroundSync()).toBe(false);
    worker({});
    expect(await requestBackgroundSync()).toBe(false);
  });

  it("a refused registration is not an error: the app sends on opening", async () => {
    worker({
      sync: {
        register: async () => {
          throw new DOMException("denied", "NotAllowedError");
        },
      },
    });
    expect(await requestBackgroundSync()).toBe(false);
  });

  it("queuing a change asks for it", async () => {
    const register = vi.fn(async () => {});
    worker({ sync: { register } });
    await addChange({
      type: "note.create",
      id: "a",
      kind: "list",
      calendarId: null,
      fields: { title: "a" },
    });
    await vi.waitFor(() => expect(register).toHaveBeenCalledWith(SYNC_TAG));
  });
});
