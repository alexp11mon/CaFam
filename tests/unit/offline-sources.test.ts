import { describe, expect, it } from "vitest";
import { offlineCalendarProps } from "@/lib/offline/offline-sources";
import type { Snapshot } from "@/lib/offline/snapshot";

// Spec 042 T5: the year's marks from the device's copy (RF-13).
const copy = {
  userId: "me",
  profile: { timeZone: "Europe/Madrid", showWeekends: true, duration: 60 },
  calendars: [],
  people: [],
  groups: [],
  preferences: { calendarPreferences: [], personPreferences: [] },
  categories: [],
  range: { from: "2026-10-19", to: "2027-02-19" },
  events: [
    {
      id: "e1",
      calendarId: "c1",
      title: "Cena",
      startsAt: "2026-12-31T22:30:00Z",
      endsAt: "2026-12-31T22:55:00Z",
      allDay: false,
    },
    {
      id: "e2",
      calendarId: "c2",
      title: "Viaje",
      startsAt: "2026-11-20T00:00:00Z",
      endsAt: "2026-11-22T00:00:00Z",
      allDay: true,
    },
  ],
} as unknown as Snapshot;

describe("offlineCalendarProps.loadYearMarks", () => {
  it("marks the days of the year with events of the copy, in the profile's zone", async () => {
    const { loadYearMarks } = offlineCalendarProps(copy);
    expect(await loadYearMarks(2026)).toEqual({
      marks: {
        "2026-11-20": ["c2"],
        "2026-11-21": ["c2"],
        "2026-12-31": ["c1"],
      },
    });
    // 23:30 in Madrid on 31 December is in 2026, not 2027.
    expect(await loadYearMarks(2027)).toEqual({ marks: {} });
  });
});
