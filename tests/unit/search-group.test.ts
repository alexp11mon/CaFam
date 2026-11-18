import { describe, expect, it } from "vitest";
import { groupResults } from "@/lib/search/group";

// Spec 039, T1: upcoming days first, then past ones newest first (RF-6).
const ev = (id: string, startsAt: string, endsAt: string, allDay = false) => ({
  id,
  startsAt,
  endsAt,
  allDay,
});

describe("groupResults", () => {
  const now = new Date("2026-11-18T12:00:00Z");

  it("groups by day in the profile zone, upcoming ascending, past descending", () => {
    const groups = groupResults(
      [
        ev("late", "2026-11-20T23:30:00Z", "2026-11-21T00:30:00Z"),
        ev("next", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
        ev("old", "2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z"),
        ev("older", "2026-01-01T09:00:00Z", "2026-01-01T10:00:00Z"),
        ev("now", "2026-11-18T11:00:00Z", "2026-11-18T13:00:00Z"),
      ],
      "Europe/Madrid",
      now,
    );
    expect(groups.upcoming.map((g) => g.day)).toEqual([
      "2026-11-18",
      "2026-11-19",
      "2026-11-21",
    ]);
    expect(groups.past.map((g) => g.day)).toEqual(["2026-10-01", "2026-01-01"]);
  });

  it("reads all-day events by their UTC date", () => {
    const groups = groupResults(
      [ev("bday", "2026-12-01T00:00:00Z", "2026-12-02T00:00:00Z", true)],
      "America/New_York",
      now,
    );
    expect(groups.upcoming[0].day).toBe("2026-12-01");
  });

  it("sorts the events of a day by start", () => {
    const groups = groupResults(
      [
        ev("b", "2026-11-19T15:00:00Z", "2026-11-19T16:00:00Z"),
        ev("a", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
      ],
      "UTC",
      now,
    );
    expect(groups.upcoming[0].events.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
