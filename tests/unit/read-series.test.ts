// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  expandRows,
  findOccurrence,
  isChanged,
} from "@/lib/recurrence/read-series";

const SERIES = {
  id: "s1",
  title: "Extraescolar",
  description: null,
  location: "Cole",
  color: null,
  category_id: null,
  starts_at: "2026-11-03T17:00:00+00:00",
  ends_at: "2026-11-03T18:00:00+00:00",
  all_day: false,
  recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
  recurrence_tz: "Europe/Madrid",
  exdates: ["2026-11-10T17:00:00+00:00"],
};

const NOVEMBER = [new Date("2026-11-01"), new Date("2026-12-01")] as const;

describe("expandRows (RF-9, RF-11)", () => {
  it("skips exdates and occurrences with an exception", () => {
    const result = expandRows(
      [SERIES],
      [{ series_id: "s1", original_start: "2026-11-17T17:00:00+00:00" }],
      ...NOVEMBER,
    );
    expect(result.map((r) => r.occurrence.startsAt.slice(0, 10))).toEqual([
      "2026-11-03",
      "2026-11-24",
    ]);
    expect(result[0]!.row).toBe(SERIES);
  });

  it("an exception of another series does not skip anything", () => {
    const result = expandRows(
      [SERIES],
      [{ series_id: "other", original_start: "2026-11-17T17:00:00+00:00" }],
      ...NOVEMBER,
    );
    expect(result).toHaveLength(3);
  });

  it("skips an unreadable rule and warns (plan R3)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      expandRows([{ ...SERIES, recurrence: "FREQ=HOURLY" }], [], ...NOVEMBER),
    ).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("findOccurrence", () => {
  it("finds an occurrence of the rule", () => {
    expect(findOccurrence(SERIES, "2026-11-24T17:00:00.000Z")).toEqual({
      originalStart: "2026-11-24T17:00:00.000Z",
      startsAt: "2026-11-24T17:00:00.000Z",
      endsAt: "2026-11-24T18:00:00.000Z",
    });
  });

  it("nothing for a time the rule does not give, or a deleted one", () => {
    expect(findOccurrence(SERIES, "2026-11-24T16:00:00.000Z")).toBeNull();
    expect(findOccurrence(SERIES, "2026-11-25T17:00:00.000Z")).toBeNull();
    expect(findOccurrence(SERIES, "2026-11-10T17:00:00.000Z")).toBeNull();
    expect(findOccurrence(SERIES, "nope")).toBeNull();
  });
});

describe("isChanged (RF-16, plan D9)", () => {
  const unchanged = {
    ...SERIES,
    starts_at: "2026-11-17T17:00:00+00:00",
    ends_at: "2026-11-17T18:00:00+00:00",
    original_start: "2026-11-17T17:00:00+00:00",
  };

  it("an exception equal to its occurrence is not changed", () => {
    expect(isChanged(unchanged, SERIES)).toBe(false);
  });

  it.each([
    { title: "Sin clase" },
    { location: null },
    { color: "#FFADAD" },
    { starts_at: "2026-11-17T16:00:00+00:00" },
    { ends_at: "2026-11-17T19:00:00+00:00" },
  ])("is changed with %j", (change) => {
    expect(isChanged({ ...unchanged, ...change }, SERIES)).toBe(true);
  });
});
