import { describe, expect, it } from "vitest";
import {
  eventDays,
  visibleDayRange,
  warmRange,
} from "@/lib/calendar/event-window";
import { formatPeriodTitle } from "@/lib/calendar/format";
import {
  calendarHref,
  getVisibleRange,
  isCalendarView,
  navigate,
  parseViewParams,
  visibleDayKeys,
} from "@/lib/calendar/ranges";
import { SHORTCUTS, shortcutFor } from "@/lib/calendar/shortcuts";

// Spec 042 T1: ranges, navigation, titles and keys of the year and 4 days.
describe("year view", () => {
  it("shows the whole year of the date", () => {
    const days = visibleDayKeys("year", "2026-11-18");
    expect(days[0]).toBe("2026-01-01");
    expect(days.at(-1)).toBe("2026-12-31");
    expect(days).toHaveLength(365);
    expect(visibleDayKeys("year", "2028-03-01")).toHaveLength(366);
  });

  it("moves a year, 29 February becoming 28", () => {
    expect(navigate("year", "2026-11-18", 1)).toBe("2027-11-18");
    expect(navigate("year", "2026-11-18", -1)).toBe("2025-11-18");
    expect(navigate("year", "2028-02-29", 1)).toBe("2029-02-28");
    expect(navigate("year", "2028-02-29", -1)).toBe("2027-02-28");
  });

  it("is titled with the year", () => {
    expect(formatPeriodTitle("year", "2026-11-18")).toBe("2026");
  });

  it("reads no events: only marks (RF-5)", () => {
    expect(eventDays("year", "2026-11-18")).toEqual({
      from: "2026-11-18",
      to: "2026-11-18",
    });
    expect(warmRange("year", "2026-11-18")).toEqual({
      from: "2026-11-18",
      to: "2026-11-18",
    });
  });
});

describe("4-day view", () => {
  it("shows 4 days in a row from the date, weekends included", () => {
    expect(visibleDayKeys("4days", "2026-11-20")).toEqual([
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
    ]);
    expect(visibleDayRange("4days", "2026-11-20")).toEqual({
      from: "2026-11-20",
      to: "2026-11-23",
    });
  });

  it("moves 4 days at a time", () => {
    expect(navigate("4days", "2026-11-20", 1)).toBe("2026-11-24");
    expect(navigate("4days", "2026-11-20", -1)).toBe("2026-11-16");
    expect(navigate("4days", "2026-12-30", 1)).toBe("2027-01-03");
  });

  it("is titled with its days", () => {
    expect(formatPeriodTitle("4days", "2026-11-20")).toBe(
      "20 nov – 23 nov 2026",
    );
  });

  it("warms the 4 days on each side", () => {
    expect(warmRange("4days", "2026-11-20")).toEqual({
      from: "2026-11-16",
      to: "2026-11-27",
    });
  });

  it("reads the instants of its days in the zone", () => {
    const range = getVisibleRange("4days", "2026-11-20", "Europe/Madrid");
    expect(range.from.toISOString()).toBe("2026-11-19T23:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });
});

describe("views in the URL and keys", () => {
  it("accepts the new views in the URL and as the saved one", () => {
    expect(isCalendarView("year")).toBe(true);
    expect(isCalendarView("4days")).toBe(true);
    expect(parseViewParams({ view: "4days" }, "2026-11-18")).toEqual({
      view: "4days",
      date: "2026-11-18",
    });
    expect(parseViewParams({}, "2026-11-18", "year").view).toBe("year");
    expect(calendarHref("year", "2026-11-18")).toBe(
      "/dashboard/calendar?view=year&date=2026-11-18",
    );
  });

  it("opens them with Y and X (RF-9)", () => {
    const press = (key: string) =>
      shortcutFor(
        {
          key,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          target: document.body,
          dialogOpen: false,
        },
        true,
      );
    expect(press("y")).toBe("year");
    expect(press("X")).toBe("4days");
    expect(SHORTCUTS.map((s) => s.keys)).toEqual(
      expect.arrayContaining(["Y", "X"]),
    );
  });
});
