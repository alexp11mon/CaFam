import { describe, expect, it } from "vitest";
import {
  calendarHref,
  getVisibleRange,
  navigate,
  parseViewParams,
  weekStart,
} from "@/lib/calendar/ranges";

const MADRID = "Europe/Madrid";
const NEW_YORK = "America/New_York";
const TODAY = "2026-10-21";

describe("weekStart", () => {
  it("returns the Monday of the week (RF-29)", () => {
    expect(weekStart("2026-10-21")).toBe("2026-10-19"); // Wednesday
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday
  });
});

describe("getVisibleRange (RF-29, RF-30)", () => {
  it("shows full Monday-Sunday weeks in the month view", () => {
    const range = getVisibleRange("month", "2026-10-21", MADRID);

    expect(range.days).toHaveLength(35);
    expect(range.days[0]).toBe("2026-09-28");
    expect(range.days.at(-1)).toBe("2026-11-01");
  });

  it("covers months of 5 and 6 weeks, and a month starting on Sunday", () => {
    expect(getVisibleRange("month", "2026-08-10", MADRID).days).toHaveLength(
      42,
    );
    const february = getVisibleRange("month", "2026-02-10", MADRID);
    expect(february.days[0]).toBe("2026-01-26");
    expect(february.days.at(-1)).toBe("2026-03-01");
  });

  it("shows seven days in the week view and one in the day view", () => {
    expect(getVisibleRange("week", "2026-10-21", MADRID).days).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(getVisibleRange("day", "2026-10-21", MADRID).days).toEqual([
      "2026-10-21",
    ]);
  });

  it("queries a window wide enough for local days and UTC all-day dates (plan D6)", () => {
    for (const tz of [MADRID, NEW_YORK]) {
      const { from, to } = getVisibleRange("day", "2026-10-21", tz);

      // Local midnight of the day and of the next day.
      const localStart = Date.parse(
        tz === MADRID ? "2026-10-20T22:00:00Z" : "2026-10-21T04:00:00Z",
      );
      const localEnd = localStart + 86_400_000;
      // All-day events of that day are stored at 00:00 UTC.
      const utcStart = Date.parse("2026-10-21T00:00:00Z");
      const utcEnd = Date.parse("2026-10-22T00:00:00Z");

      expect(from.getTime(), tz).toBeLessThanOrEqual(
        Math.min(localStart, utcStart),
      );
      expect(to.getTime(), tz).toBeGreaterThanOrEqual(
        Math.max(localEnd, utcEnd),
      );
    }
  });
});

describe("navigate (RF-29)", () => {
  it("moves by month, week and day", () => {
    expect(navigate("month", "2026-10-21", 1)).toBe("2026-11-01");
    expect(navigate("month", "2026-10-21", -1)).toBe("2026-09-01");
    expect(navigate("month", "2026-12-15", 1)).toBe("2027-01-01");
    expect(navigate("month", "2026-01-15", -1)).toBe("2025-12-01");
    expect(navigate("week", "2026-10-21", 1)).toBe("2026-10-28");
    expect(navigate("week", "2026-10-21", -1)).toBe("2026-10-14");
    expect(navigate("day", "2026-10-31", 1)).toBe("2026-11-01");
    expect(navigate("day", "2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("parseViewParams (RF-30)", () => {
  it("defaults to the month view of today", () => {
    expect(parseViewParams({}, TODAY)).toEqual({ view: "month", date: TODAY });
  });

  it("keeps valid values", () => {
    expect(
      parseViewParams({ view: "week", date: "2026-02-03" }, TODAY),
    ).toEqual({ view: "week", date: "2026-02-03" });
  });

  it("falls back for invalid values and arrays", () => {
    expect(
      parseViewParams({ view: "year", date: "2026-13-01" }, TODAY),
    ).toEqual({ view: "month", date: TODAY });
    expect(
      parseViewParams({ view: ["day", "week"], date: ["2026-01-01"] }, TODAY),
    ).toEqual({ view: "month", date: TODAY });
  });
});

describe("calendarHref (RF-29, RF-37)", () => {
  it("builds the calendar URL", () => {
    expect(calendarHref("week", "2026-10-21")).toBe(
      "/dashboard/calendar?view=week&date=2026-10-21",
    );
  });
});
