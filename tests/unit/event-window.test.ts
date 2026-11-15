import { describe, expect, it } from "vitest";
import {
  eventsInRange,
  mergeWindow,
  planLoad,
  serverWindow,
  trimWindow,
  visibleDayRange,
  warmRange,
  WINDOW_KEEP_DAYS,
  WINDOW_MAX_DAYS,
} from "@/lib/calendar/event-window";
import { daysBetween } from "@/lib/calendar/ranges";

const event = (id: string, startsAt: string, endsAt = startsAt) => ({
  id,
  startsAt,
  endsAt,
});

describe("visibleDayRange", () => {
  it("gives the whole weeks of a month", () => {
    expect(visibleDayRange("month", "2026-11-15")).toEqual({
      from: "2026-10-26",
      to: "2026-12-06",
    });
  });

  it("gives the week from Monday and the single day", () => {
    expect(visibleDayRange("week", "2026-11-15")).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    });
    expect(visibleDayRange("day", "2026-11-15")).toEqual({
      from: "2026-11-15",
      to: "2026-11-15",
    });
  });
});

describe("serverWindow", () => {
  it("covers the previous and the next month around the date (RF-1)", () => {
    const window = serverWindow("2026-11-15");
    expect(window.from).toBe(visibleDayRange("month", "2026-10-01").from);
    expect(window.to).toBe(visibleDayRange("month", "2026-12-01").to);
  });

  it("always covers the days the agenda opens with", () => {
    // The 31st: the next month ends before the agenda's 42 days.
    const window = serverWindow("2027-01-31");
    expect(window.from <= "2027-01-17").toBe(true);
    expect(window.to >= "2027-03-13").toBe(true);
  });

  it("fits in one call of the loading action", () => {
    for (const date of [
      "2026-01-31",
      "2026-02-01",
      "2026-07-31",
      "2026-12-15",
    ]) {
      const window = serverWindow(date);
      expect(daysBetween(window.from, window.to) + 1).toBeLessThanOrEqual(
        WINDOW_MAX_DAYS,
      );
    }
  });
});

describe("warmRange", () => {
  it("adds one period on each side (RF-3)", () => {
    expect(warmRange("month", "2026-11-15")).toEqual({
      from: visibleDayRange("month", "2026-10-01").from,
      to: visibleDayRange("month", "2026-12-01").to,
    });
    expect(warmRange("week", "2026-11-15")).toEqual({
      from: "2026-11-02",
      to: "2026-11-22",
    });
    expect(warmRange("day", "2026-11-15")).toEqual({
      from: "2026-11-08",
      to: "2026-11-22",
    });
  });
});

describe("planLoad", () => {
  const loaded = { from: "2026-10-01", to: "2026-12-31" };

  it("needs nothing when the range is loaded", () => {
    expect(
      planLoad(loaded, { from: "2026-11-01", to: "2026-11-30" }),
    ).toBeNull();
    expect(planLoad(loaded, loaded)).toBeNull();
  });

  it("extends by the side that is missing", () => {
    expect(planLoad(loaded, { from: "2026-12-20", to: "2027-01-10" })).toEqual({
      mode: "extend",
      ranges: [{ from: "2027-01-01", to: "2027-01-10" }],
    });
    expect(planLoad(loaded, { from: "2026-09-20", to: "2026-10-05" })).toEqual({
      mode: "extend",
      ranges: [{ from: "2026-09-20", to: "2026-09-30" }],
    });
  });

  it("extends by both sides at once", () => {
    expect(planLoad(loaded, { from: "2026-09-25", to: "2027-01-05" })).toEqual({
      mode: "extend",
      ranges: [
        { from: "2026-09-25", to: "2026-09-30" },
        { from: "2027-01-01", to: "2027-01-05" },
      ],
    });
  });

  it("extends a range that only touches the window", () => {
    expect(planLoad(loaded, { from: "2027-01-01", to: "2027-01-07" })).toEqual({
      mode: "extend",
      ranges: [{ from: "2027-01-01", to: "2027-01-07" }],
    });
  });

  it("replaces the window after a far jump (RF-4, plan D4)", () => {
    expect(planLoad(loaded, { from: "2027-06-01", to: "2027-06-30" })).toEqual({
      mode: "replace",
      ranges: [{ from: "2027-06-01", to: "2027-06-30" }],
    });
  });

  it("never asks for more days than one call reads", () => {
    const plan = planLoad(loaded, { from: "2027-01-01", to: "2027-12-31" });
    expect(plan?.ranges).toHaveLength(1);
    const [range] = plan!.ranges;
    expect(range!.from).toBe("2027-01-01");
    expect(daysBetween(range!.from, range!.to) + 1).toBe(WINDOW_MAX_DAYS);
  });
});

describe("mergeWindow", () => {
  const window = {
    range: { from: "2026-11-01", to: "2026-11-30" },
    events: [
      event("a", "2026-11-10T10:00:00Z"),
      event("b", "2026-11-30T23:00:00Z", "2026-12-01T01:00:00Z"),
    ],
  };

  it("joins the ranges and keeps one copy of each event, the new one", () => {
    const merged = mergeWindow(
      window,
      {
        range: { from: "2026-12-01", to: "2026-12-31" },
        events: [
          { ...event("b", "2026-11-30T23:00:00Z", "2026-12-01T02:00:00Z") },
          event("c", "2026-12-05T10:00:00Z"),
        ],
      },
      "extend",
    );
    expect(merged.range).toEqual({ from: "2026-11-01", to: "2026-12-31" });
    expect(merged.events.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(merged.events[1]!.endsAt).toBe("2026-12-01T02:00:00Z");
  });

  it("drops the old window when replacing", () => {
    const fetched = {
      range: { from: "2027-06-01", to: "2027-06-30" },
      events: [event("z", "2027-06-02T10:00:00Z")],
    };
    expect(mergeWindow(window, fetched, "replace")).toEqual(fetched);
  });
});

describe("trimWindow", () => {
  it("leaves a window within the limit alone", () => {
    const window = {
      range: { from: "2026-01-01", to: "2026-12-31" },
      events: [event("a", "2026-03-01T10:00:00Z")],
    };
    expect(trimWindow(window, { from: "2026-06-01", to: "2026-06-30" })).toBe(
      window,
    );
  });

  it("lets go of what is furthest from what is shown (RF-6)", () => {
    const window = {
      range: { from: "2025-01-01", to: "2027-12-31" },
      events: [
        event("old", "2025-02-01T10:00:00Z"),
        event("near", "2026-06-10T10:00:00Z"),
        event("far", "2027-11-01T10:00:00Z"),
      ],
    };
    const trimmed = trimWindow(window, {
      from: "2026-06-01",
      to: "2026-06-30",
    });
    expect(
      daysBetween(trimmed.range.from, trimmed.range.to) + 1,
    ).toBeLessThanOrEqual(WINDOW_KEEP_DAYS);
    expect(trimmed.range.from <= "2026-06-01").toBe(true);
    expect(trimmed.range.to >= "2026-06-30").toBe(true);
    expect(trimmed.events.map((e) => e.id)).toEqual(["near"]);
  });
});

describe("eventsInRange", () => {
  it("keeps what overlaps [from, to), as the query does", () => {
    const events = [
      event("before", "2026-11-01T08:00:00Z", "2026-11-01T09:00:00Z"),
      event("across", "2026-11-01T23:00:00Z", "2026-11-02T01:00:00Z"),
      event("inside", "2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"),
      event("at-end", "2026-11-03T00:00:00Z", "2026-11-03T01:00:00Z"),
    ];
    expect(
      eventsInRange(
        events,
        new Date("2026-11-02T00:00:00Z"),
        new Date("2026-11-03T00:00:00Z"),
      ).map((e) => e.id),
    ).toEqual(["across", "inside"]);
  });
});
