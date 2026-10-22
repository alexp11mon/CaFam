import { describe, expect, it } from "vitest";
import { monthMarks, visibleMarks } from "@/lib/calendar/month-marks";

// Spec 005, T4: the colored dots under the days of the mini month
// (RF-24; plan mini-month, D10).
const MADRID = "Europe/Madrid";
const DAYS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];

function event(
  calendarId: string,
  startsAt: string,
  endsAt: string,
  allDay = false,
) {
  return {
    id: `${calendarId}-${startsAt}`,
    calendarId,
    startsAt,
    endsAt,
    allDay,
  };
}

describe("monthMarks", () => {
  it("lists each calendar with events on a day once, in order of appearance", () => {
    const marks = monthMarks(
      [
        event("work", "2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z"),
        event("home", "2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"),
        event("work", "2026-11-02T12:00:00Z", "2026-11-02T13:00:00Z"),
      ],
      DAYS,
      MADRID,
    );

    expect(marks).toEqual({ "2026-11-02": ["work", "home"] });
  });

  it("marks every day of a multi-day or all-day event", () => {
    const marks = monthMarks(
      [
        event("trip", "2026-11-03T00:00:00Z", "2026-11-05T00:00:00Z", true),
        // 23:00 on the 4th to 01:00 on the 5th in Madrid.
        event("party", "2026-11-04T22:00:00Z", "2026-11-05T00:00:00Z"),
      ],
      DAYS,
      MADRID,
    );

    expect(marks).toEqual({
      "2026-11-03": ["trip"],
      "2026-11-04": ["trip", "party"],
      "2026-11-05": ["party"],
    });
  });

  it("ignores days outside the month", () => {
    const marks = monthMarks(
      [event("work", "2026-11-30T08:00:00Z", "2026-11-30T09:00:00Z")],
      DAYS,
      MADRID,
    );

    expect(marks).toEqual({});
  });
});

describe("visibleMarks (RF-24)", () => {
  it("keeps at most three visible calendars per day", () => {
    const marks = {
      "2026-11-02": ["a", "hidden", "b", "c", "d"],
      "2026-11-03": ["hidden"],
    };

    expect(visibleMarks(marks, new Set(["a", "b", "c", "d"]))).toEqual({
      "2026-11-02": ["a", "b", "c"],
    });
  });
});
