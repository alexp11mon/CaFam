// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 024, T3: more days for the browser's window, with the user's session.
const state = vi.hoisted(() => ({
  ranges: [] as [Date, Date][],
  busy: [] as [Date, Date][],
  fail: false,
}));

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: {}, userId: "me" }),
  getProfileTimeZone: async () => "Europe/Madrid",
  getMyCalendars: async () => [
    { id: "work", name: "Trabajo", color: "#FFADAD" },
  ],
  getEventsInRange: async (_supabase: unknown, from: Date, to: Date) => {
    if (state.fail) throw new TypeError("fetch failed");
    state.ranges.push([from, to]);
    return [
      {
        id: "e1",
        calendarId: "work",
        title: "Reunión",
        startsAt: "2026-11-05T09:00:00Z",
        endsAt: "2026-11-05T10:00:00Z",
        allDay: false,
        color: null,
        categoryId: null,
        location: null,
        imageCount: 0,
        commentCount: 0,
      },
    ];
  },
}));
vi.mock("@/lib/availability/queries", () => ({
  getBusyIntervals: async (_supabase: unknown, from: Date, to: Date) => {
    if (state.fail) throw new TypeError("fetch failed");
    state.busy.push([from, to]);
    return [
      {
        personId: "ana",
        startsAt: "2026-11-05T09:00:00Z",
        endsAt: "2026-11-05T10:00:00Z",
        allDay: false,
      },
    ];
  },
}));

const { loadBusy, loadCalendarWindow } =
  await import("@/app/dashboard/calendar/window-actions");

beforeEach(() => {
  state.ranges = [];
  state.busy = [];
  state.fail = false;
});

describe("loadCalendarWindow", () => {
  it("reads the days, whatever the zone, and returns view events", async () => {
    const result = await loadCalendarWindow("2027-01-04", "2027-01-31");
    expect(result).toEqual({
      events: [
        expect.objectContaining({
          id: "e1",
          color: "#FFADAD",
          calendarName: "Trabajo",
        }),
      ],
    });
    // No zone asked for: the days with 14 h of slack on each side.
    expect(state.ranges[0]![0].toISOString()).toBe("2027-01-03T10:00:00.000Z");
    expect(state.ranges[0]![1].toISOString()).toBe("2027-02-01T14:00:00.000Z");
  });

  it("refuses anything that is not two dates in order, at most 124 days", async () => {
    for (const [from, to] of [
      ["2027-01-04", "nope"],
      ["x", "2027-01-31"],
      ["2027-02-01", "2027-01-31"],
      ["2027-01-01", "2027-05-05"],
    ] as const) {
      expect(await loadCalendarWindow(from, to)).toHaveProperty("error");
    }
    expect(state.ranges).toHaveLength(0);
    expect(await loadCalendarWindow("2027-01-01", "2027-05-04")).toHaveProperty(
      "events",
    );
  });

  it("answers with a message when the read fails", async () => {
    state.fail = true;
    expect(await loadCalendarWindow("2027-01-04", "2027-01-31")).toEqual({
      error: expect.stringContaining("conectar"),
    });
  });
});

describe("loadBusy", () => {
  it("reads the busy times of a week", async () => {
    expect(await loadBusy("2026-11-02", "2026-11-08")).toEqual({
      busy: [expect.objectContaining({ personId: "ana" })],
    });
    expect(state.busy).toHaveLength(1);
  });

  it("refuses more days than grid_busy reads", async () => {
    expect(await loadBusy("2026-11-01", "2026-12-15")).toHaveProperty("error");
    expect(await loadBusy("2026-11-01", "bad")).toHaveProperty("error");
    expect(state.busy).toHaveLength(0);
  });
});
