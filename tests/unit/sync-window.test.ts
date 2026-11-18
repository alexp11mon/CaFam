import { describe, expect, it } from "vitest";
import { isOutsideWindow } from "@/lib/sync/window";
import { staleCopyText } from "@/lib/sync/provider-labels";

// Spec 038, T3: an old synced event is a copy that is no longer updated (RF-6).
describe("isOutsideWindow", () => {
  const now = new Date("2026-11-18T12:00:00Z");

  it("is true for an event that started before the window", () => {
    expect(isOutsideWindow("2026-05-17T23:59:59.999Z", now)).toBe(true);
  });

  it("is false on the exact edge and inside", () => {
    expect(isOutsideWindow("2026-05-18T00:00:00.000Z", now)).toBe(false);
    expect(isOutsideWindow("2026-11-01T10:00:00Z", now)).toBe(false);
  });
});

describe("staleCopyText", () => {
  it("names the provider", () => {
    expect(staleCopyText("google")).toBe(
      "Copia antigua: ya no se actualiza desde Google",
    );
    expect(staleCopyText("icloud")).toBe(
      "Copia antigua: ya no se actualiza desde iCloud",
    );
  });
});
