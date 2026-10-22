// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 005, T9: the marks of another month for the mini month, read with the
// user's session (RF-26; plan "Server Actions", D10).
const ME = "99999999-9999-4999-8999-999999999999";

const state = vi.hoisted(() => ({
  ranges: [] as [Date, Date][],
  events: [] as unknown[],
  fail: false,
}));

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: {}, userId: ME }),
  getProfileTimeZone: async () => "Europe/Madrid",
  getEventsInRange: async (_supabase: unknown, from: Date, to: Date) => {
    if (state.fail) throw new TypeError("fetch failed");
    state.ranges.push([from, to]);
    return state.events;
  },
}));

const { loadMonthMarks } =
  await import("@/app/dashboard/calendar/mini-month-actions");

beforeEach(() => {
  state.ranges = [];
  state.events = [];
  state.fail = false;
});

describe("loadMonthMarks (RF-26)", () => {
  it("reads the weeks of the month and marks the calendars of each day", async () => {
    state.events = [
      {
        id: "e1",
        calendarId: "work",
        startsAt: "2026-11-05T09:00:00Z",
        endsAt: "2026-11-05T10:00:00Z",
        allDay: false,
      },
    ];

    const result = await loadMonthMarks("2026-11");

    expect(result).toEqual({ marks: { "2026-11-05": ["work"] } });
    // Monday 26 October to Monday 7 December, local and UTC days covered.
    expect(state.ranges[0]![0].toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(state.ranges[0]![1].toISOString()).toBe("2026-12-07T00:00:00.000Z");
  });

  it.each(["2026-13", "2026-1", "nov", ""])(
    "rejects %j without reading",
    async (month) => {
      const result = await loadMonthMarks(month);

      expect(result).toEqual({ error: "Este elemento ya no existe." });
      expect(state.ranges).toEqual([]);
    },
  );

  it("uses the connection message when reading fails", async () => {
    state.fail = true;

    const result = await loadMonthMarks("2026-11");

    expect(result).toEqual({
      error:
        "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
    });
  });
});
