import { describe, expect, it } from "vitest";
import {
  addDays,
  allDayFromRange,
  allDayToRange,
  formatDateKey,
  formatTime,
  parseDateKey,
  utcToZonedParts,
  weekdayIndex,
  zonedDateKey,
  zonedLocalToUtc,
} from "@/lib/calendar/time-zone";

const MADRID = "Europe/Madrid";
const NEW_YORK = "America/New_York";

function local(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
) {
  return { year, month, day, hour, minute };
}

describe("utcToZonedParts (RF-34)", () => {
  it("converts an instant to wall-clock parts in the zone", () => {
    expect(utcToZonedParts("2026-07-01T10:00:00Z", MADRID)).toEqual({
      year: 2026,
      month: 7,
      day: 1,
      hour: 12,
      minute: 0,
      second: 0,
    });
    expect(utcToZonedParts("2026-01-01T00:30:00Z", NEW_YORK)).toMatchObject({
      year: 2025,
      month: 12,
      day: 31,
      hour: 19,
      minute: 30,
    });
  });

  it("shows midnight as hour 0, never 24", () => {
    expect(utcToZonedParts("2026-10-24T22:00:00Z", MADRID).hour).toBe(0);
  });
});

describe("zonedLocalToUtc", () => {
  it("applies winter and summer offsets", () => {
    expect(zonedLocalToUtc(local(2026, 1, 15, 9), MADRID).toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
    expect(zonedLocalToUtc(local(2026, 7, 1, 9), MADRID).toISOString()).toBe(
      "2026-07-01T07:00:00.000Z",
    );
    expect(zonedLocalToUtc(local(2026, 1, 15, 9), NEW_YORK).toISOString()).toBe(
      "2026-01-15T14:00:00.000Z",
    );
    expect(zonedLocalToUtc(local(2026, 7, 1, 9), NEW_YORK).toISOString()).toBe(
      "2026-07-01T13:00:00.000Z",
    );
  });

  it("keeps the typed hour on both sides of a clock change", () => {
    expect(zonedLocalToUtc(local(2026, 3, 28, 12), MADRID).toISOString()).toBe(
      "2026-03-28T11:00:00.000Z",
    );
    expect(zonedLocalToUtc(local(2026, 3, 29, 12), MADRID).toISOString()).toBe(
      "2026-03-29T10:00:00.000Z",
    );
    expect(zonedLocalToUtc(local(2026, 10, 25, 12), MADRID).toISOString()).toBe(
      "2026-10-25T11:00:00.000Z",
    );
  });

  it("moves a nonexistent spring hour forward (02:30 -> 03:30)", () => {
    const result = zonedLocalToUtc(local(2026, 3, 29, 2, 30), MADRID);

    expect(result.toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(utcToZonedParts(result, MADRID)).toMatchObject({
      hour: 3,
      minute: 30,
    });
  });

  it("picks the first occurrence of an ambiguous autumn hour", () => {
    expect(
      zonedLocalToUtc(local(2026, 10, 25, 2, 30), MADRID).toISOString(),
    ).toBe("2026-10-25T00:30:00.000Z");
  });

  it("handles midnight", () => {
    expect(zonedLocalToUtc(local(2026, 10, 25, 0), MADRID).toISOString()).toBe(
      "2026-10-24T22:00:00.000Z",
    );
  });

  it("round-trips the wall-clock time of every real instant around clock changes", () => {
    for (const start of ["2026-03-27T00:00:00Z", "2026-10-24T00:00:00Z"]) {
      for (let hour = 0; hour < 24 * 5; hour += 1) {
        const instant = new Date(Date.parse(start) + hour * 3_600_000);
        const parts = utcToZonedParts(instant, MADRID);

        const back = zonedLocalToUtc(parts, MADRID);

        expect(utcToZonedParts(back, MADRID)).toEqual(parts);
      }
    }
  });
});

describe("date keys", () => {
  it("parses valid YYYY-MM-DD and rejects anything else", () => {
    expect(parseDateKey("2026-10-21")).toEqual({
      year: 2026,
      month: 10,
      day: 21,
    });
    for (const bad of ["2026-02-30", "2026-13-01", "26-1-1", "", "2026-10-2"]) {
      expect(parseDateKey(bad), bad).toBeNull();
    }
    expect(parseDateKey("2028-02-29")).not.toBeNull();
    expect(parseDateKey("2026-02-29")).toBeNull();
  });

  it("formats with zero padding", () => {
    expect(formatDateKey({ year: 2026, month: 3, day: 4 })).toBe("2026-03-04");
  });

  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-10-21", 0)).toBe("2026-10-21");
  });

  it("numbers weekdays from Monday", () => {
    expect(weekdayIndex("2026-10-19")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-21")).toBe(2); // Wednesday
    expect(weekdayIndex("2026-10-25")).toBe(6); // Sunday
  });

  it("gives the local day of an instant in the zone", () => {
    expect(zonedDateKey("2026-10-24T22:30:00Z", MADRID)).toBe("2026-10-25");
    expect(zonedDateKey("2026-10-24T22:30:00Z", NEW_YORK)).toBe("2026-10-24");
  });
});

describe("formatTime (RF-34)", () => {
  it("shows HH:mm in the zone", () => {
    expect(formatTime("2026-07-01T07:05:00Z", MADRID)).toBe("09:05");
    expect(formatTime("2026-07-01T07:05:00Z", NEW_YORK)).toBe("03:05");
  });
});

describe("all-day events as UTC dates (RF-20, plan D6)", () => {
  it("stores the first day at 00:00 UTC and an exclusive end", () => {
    expect(allDayToRange("2026-12-24", "2026-12-26")).toEqual({
      startsAt: "2026-12-24T00:00:00.000Z",
      endsAt: "2026-12-27T00:00:00.000Z",
    });
    expect(allDayToRange("2026-12-24", "2026-12-24")).toEqual({
      startsAt: "2026-12-24T00:00:00.000Z",
      endsAt: "2026-12-25T00:00:00.000Z",
    });
  });

  it("returns the inclusive last day when reading back", () => {
    expect(
      allDayFromRange("2026-12-24T00:00:00+00:00", "2026-12-27T00:00:00+00:00"),
    ).toEqual({ startDate: "2026-12-24", endDate: "2026-12-26" });
  });

  it("never returns an end before the start", () => {
    expect(
      allDayFromRange("2026-12-24T00:00:00Z", "2026-12-24T00:00:00Z"),
    ).toEqual({ startDate: "2026-12-24", endDate: "2026-12-24" });
  });
});
