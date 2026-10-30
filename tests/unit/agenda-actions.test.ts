// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 016, T9: the agenda loads its chunks with the user's session (RF-48, RF-49).
const ME = "99999999-9999-4999-8999-999999999999";

const state = vi.hoisted(() => ({
  ranges: [] as [Date, Date][],
  events: [] as unknown[],
  fail: false,
}));

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: {}, userId: ME }),
  getProfileTimeZone: async () => "Europe/Madrid",
  getMyCalendars: async () => [
    { id: "work", name: "Trabajo", color: "#FFADAD" },
    { id: "home", name: "Casa", color: "#CAFFBF" },
  ],
  getEventsInRange: async (_supabase: unknown, from: Date, to: Date) => {
    if (state.fail) throw new TypeError("fetch failed");
    state.ranges.push([from, to]);
    return state.events;
  },
}));

const { loadAgendaEvents } =
  await import("@/app/dashboard/calendar/agenda-actions");

beforeEach(() => {
  state.ranges = [];
  state.events = [];
  state.fail = false;
});

const record = {
  id: "e1",
  calendarId: "work",
  title: "Reunión",
  startsAt: "2026-11-05T09:00:00Z",
  endsAt: "2026-11-05T10:00:00Z",
  allDay: false,
  color: null,
  categoryId: null,
  location: "Oficina",
  imageCount: 0,
};

describe("loadAgendaEvents", () => {
  it("reads the days with their local and UTC edges and returns view events", async () => {
    state.events = [record, { ...record, id: "e2", color: "#BDB2FF" }];

    const result = await loadAgendaEvents("2026-11-01", "2026-11-28");

    expect(result).toEqual({
      events: [
        expect.objectContaining({
          id: "e1",
          color: "#FFADAD",
          calendarName: "Trabajo",
          location: "Oficina",
        }),
        expect.objectContaining({ id: "e2", color: "#BDB2FF" }),
      ],
    });
    expect(state.ranges[0]![0].toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(state.ranges[0]![1].toISOString()).toBe("2026-11-29T00:00:00.000Z");
  });

  it("accepts 62 days", async () => {
    expect(await loadAgendaEvents("2026-11-01", "2027-01-01")).toEqual({
      events: [],
    });
  });

  it.each([
    ["2026-13-01", "2026-12-01"],
    ["nov", "2026-12-01"],
    ["2026-11-10", "2026-11-09"],
    ["2026-11-01", "2027-01-02"],
  ])("rejects %j to %j without reading", async (from, to) => {
    const result = await loadAgendaEvents(from, to);

    expect(result).toEqual({ error: "Este elemento ya no existe." });
    expect(state.ranges).toEqual([]);
  });

  it("says it cannot connect when the database fails", async () => {
    state.fail = true;

    expect(await loadAgendaEvents("2026-11-01", "2026-11-28")).toEqual({
      error:
        "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
    });
  });
});
