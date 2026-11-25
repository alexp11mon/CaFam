import { describe, expect, it } from "vitest";
import { todayLeft } from "@/lib/badge/today-left";

const now = new Date("2026-11-25T12:00:00Z");
const dayEnd = new Date("2026-11-25T23:00:00Z");
const ev = (startsAt: string, endsAt: string, extra = {}) => ({
  calendarId: "c1",
  startsAt,
  endsAt,
  allDay: false,
  ...extra,
});

describe("todayLeft (spec 047 RF-12)", () => {
  it("counts timed events of visible calendars that still have to end today", () => {
    expect(
      todayLeft(
        [
          ev("2026-11-25T09:00:00Z", "2026-11-25T10:00:00Z"), // over
          ev("2026-11-25T11:30:00Z", "2026-11-25T12:30:00Z"), // now
          ev("2026-11-25T18:00:00Z", "2026-11-25T19:00:00Z"), // later
          ev("2026-11-25T23:00:00Z", "2026-11-26T00:00:00Z"), // tomorrow
          ev("2026-11-25T00:00:00Z", "2026-11-26T00:00:00Z", { allDay: true }),
          ev("2026-11-25T18:00:00Z", "2026-11-25T19:00:00Z", {
            calendarId: "hidden",
          }),
        ],
        new Set(["hidden"]),
        now,
        dayEnd,
      ),
    ).toBe(2);
  });
});
