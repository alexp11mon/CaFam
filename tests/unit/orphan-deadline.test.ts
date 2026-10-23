import { describe, expect, it } from "vitest";
import { daysLeft, orphanDeadline } from "@/lib/account/orphan";

// Spec 006, T19: a calendar without owner has 15 days for its members to
// decide (RF-21, RF-26).
const DAY = 24 * 60 * 60 * 1000;
const ORPHANED_AT = "2026-11-01T10:00:00.000Z";
const start = Date.parse(ORPHANED_AT);

describe("orphan deadline (RF-26)", () => {
  it("ends 15 days after the owner left", () => {
    expect(orphanDeadline(ORPHANED_AT).toISOString()).toBe(
      "2026-11-16T10:00:00.000Z",
    );
  });

  it("has 15 days left right after", () => {
    expect(daysLeft(ORPHANED_AT, start)).toBe(15);
  });

  it("counts a partial day as a whole one", () => {
    expect(daysLeft(ORPHANED_AT, start + 14 * DAY + 60 * 60 * 1000)).toBe(1);
  });

  it("has 0 days left on the deadline and after it", () => {
    expect(daysLeft(ORPHANED_AT, start + 15 * DAY)).toBe(0);
    expect(daysLeft(ORPHANED_AT, start + 20 * DAY)).toBe(0);
  });
});
