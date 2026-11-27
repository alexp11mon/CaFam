import { describe, expect, it } from "vitest";
import { nowWindow } from "@/lib/now/window";

// Spec 054 T2: today and tomorrow in the profile's zone (RF-10, RF-11).
describe("nowWindow", () => {
  it("goes from today's 00:00 to the day after tomorrow's, in the zone", () => {
    const window = nowWindow(
      Date.parse("2026-11-27T22:30:00Z"),
      "Europe/Madrid",
    );
    // 23:30 in Madrid: still the 27th.
    expect(window.day).toBe("2026-11-27");
    expect(window.todayEnd.toISOString()).toBe("2026-11-27T23:00:00.000Z");
    expect(window.tomorrowEnd.toISOString()).toBe("2026-11-28T23:00:00.000Z");
    // The read also covers all-day events, stored at 00:00 UTC.
    expect(window.from.toISOString()).toBe("2026-11-26T23:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-11-29T00:00:00.000Z");
  });

  it("uses the real instants on a daylight saving day", () => {
    // 2026-03-29: Madrid goes from +1 to +2 at 02:00.
    const window = nowWindow(
      Date.parse("2026-03-28T12:00:00Z"),
      "Europe/Madrid",
    );
    expect(window.todayEnd.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(window.tomorrowEnd.toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("takes the date of the zone, not of UTC", () => {
    const window = nowWindow(
      Date.parse("2026-11-28T03:00:00Z"),
      "America/New_York",
    );
    expect(window.day).toBe("2026-11-27");
    expect(window.todayEnd.toISOString()).toBe("2026-11-28T05:00:00.000Z");
  });
});
