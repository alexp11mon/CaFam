import { describe, expect, it } from "vitest";
import { CALENDAR_COLORS } from "@/lib/calendar/palette";
import * as limits from "@/lib/sync/limits";
import { limitEvents } from "@/lib/sync/limit-events";
import { nearestColor } from "@/lib/sync/nearest-color";
import { syncWindow } from "@/lib/sync/window";

// Spec 007, T5: limits, window, cap and color (RF-8, RF-10, RF-14, RF-15, RF-19).

describe("limits", () => {
  it("matches the spec", () => {
    expect(limits).toMatchObject({
      MAX_ACCOUNTS: 5,
      MAX_CALENDARS_PER_ACCOUNT: 20,
      MAX_EVENTS: 2000,
      MAX_FETCHED_EVENTS: 10_000,
      MONTHS_BACK: 6,
      MONTHS_AHEAD: 12,
      MANUAL_COOLDOWN_MS: 5 * 60_000,
      FAILURES_BEFORE_NOTICE: 3,
      AUTO_INTERVAL_HOURS: 6,
    });
  });
});

describe("syncWindow (RF-15)", () => {
  it("goes from 6 months before to 12 months after today, in UTC days", () => {
    const { from, to } = syncWindow(new Date("2026-10-27T15:30:00Z"));
    expect(from.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(to.toISOString()).toBe("2027-10-27T00:00:00.000Z");
  });

  it("clamps to the end of a shorter month", () => {
    const { from, to } = syncWindow(new Date("2026-08-31T10:00:00Z"));
    expect(from.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(to.toISOString()).toBe("2027-08-31T00:00:00.000Z");
  });

  it("handles a leap day", () => {
    const { from, to } = syncWindow(new Date("2028-02-29T00:00:00Z"));
    expect(from.toISOString()).toBe("2027-08-29T00:00:00.000Z");
    expect(to.toISOString()).toBe("2029-02-28T00:00:00.000Z");
  });
});

describe("limitEvents (RF-19)", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  const DAY = 86_400_000;

  it("keeps the 2,000 nearest to today and counts the rest", () => {
    // 1,250 days before and after today, one event per day.
    const events = Array.from({ length: 2500 }, (_, i) => {
      const start = now.getTime() + (i - 1250) * DAY;
      return {
        id: i,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(start + 3_600_000).toISOString(),
      };
    });

    const { events: kept, omitted } = limitEvents(events, now);

    expect(omitted).toBe(500);
    expect(kept).toHaveLength(2000);
    const ids = kept.map((e) => e.id);
    expect(ids).toContain(1250);
    expect(ids).not.toContain(0);
    expect(ids).not.toContain(2499);
    // Original order is kept.
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it("leaves short lists untouched", () => {
    const events = [
      { starts_at: now.toISOString(), ends_at: now.toISOString() },
    ];
    expect(limitEvents(events, now)).toEqual({ events, omitted: 0 });
  });
});

describe("nearestColor (RF-10)", () => {
  const palette = CALENDAR_COLORS.map((c) => c.value);

  it("always returns a palette color", () => {
    for (const input of [
      "#000000",
      "#FFFFFF",
      "#ff0000",
      "#0b8043",
      "#7986cb",
    ]) {
      expect(palette).toContain(nearestColor(input));
    }
  });

  it("keeps a palette color as it is", () => {
    expect(nearestColor("#cafFbf")).toBe("#CAFFBF");
  });

  it("falls back to the default for missing or invalid input", () => {
    expect(nearestColor(null)).toBe("#A0C4FF");
    expect(nearestColor("blue")).toBe("#A0C4FF");
  });
});
