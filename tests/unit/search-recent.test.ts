import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addRecent,
  readRecent,
  removeRecent,
  RECENT_KEY,
} from "@/lib/search/recent";

// Spec 039, T1: the last 5 searches, only on this device (RF-9, plan D5).
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("recent searches", () => {
  it("keeps 5 at most, newest first and without repeats", () => {
    for (const q of ["uno", "dos", "tres", "cuatro", "cinco", "seis", "DOS"]) {
      addRecent(q);
    }
    expect(readRecent()).toEqual(["DOS", "seis", "cinco", "cuatro", "tres"]);
  });

  it("removes one", () => {
    addRecent("uno");
    addRecent("dos");
    removeRecent("uno");
    expect(readRecent()).toEqual(["dos"]);
  });

  it("ignores broken data and a storage that throws", () => {
    localStorage.setItem(RECENT_KEY, "{not json");
    expect(readRecent()).toEqual([]);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readRecent()).toEqual([]);
    expect(() => addRecent("x")).not.toThrow();
  });
});
