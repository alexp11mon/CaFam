// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposalRow } from "@/lib/assistant/schemas";

// Spec 022, T7: the proposal's actions with the provider simulated (RF-40,
// RF-43, RF-44, RF-46; plan D4, D5).
const MINE = "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11";
const READ_ONLY = "0c2d9a1b-1111-4c1e-9a43-2b7d7a1f0c22";
const GOOGLE = "0c2d9a1b-2222-4c1e-9a43-2b7d7a1f0c33";

const h = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  writeEvent: vi.fn(),
  inserts: [] as Record<string, unknown>[],
  events: [] as object[],
}));

vi.mock("@/lib/sync/write-event", () => ({ writeEvent: h.writeEvent }));
vi.mock("@/lib/sync/engine", () => ({ writeEngineDeps: () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));

const supabase = {
  from: () => ({
    insert: (row: Record<string, unknown>) => {
      h.inserts.push(row);
      return {
        select: () => ({
          single: async () => ({
            data: { id: `new-${h.inserts.length}` },
            error: null,
          }),
        }),
      };
    },
  }),
};

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase, userId: "u1" }),
  getProfileTimeZone: async () => "Europe/Madrid",
  getMyCalendars: async () => [
    { id: MINE, role: "owner", synced: null },
    { id: READ_ONLY, role: "viewer", synced: null },
    { id: GOOGLE, role: "editor", synced: { canWrite: true } },
  ],
  getEventsInRange: async () => h.events,
}));

const { checkProposal, createProposedEvents } =
  await import("@/app/dashboard/assistant/actions");

function row(over: Partial<ProposalRow> = {}): ProposalRow {
  return {
    key: "r1",
    title: "Turno",
    startDate: "2026-11-16",
    start: "08:00",
    endDate: "2026-11-16",
    end: "15:00",
    allDay: false,
    calendarId: MINE,
    selected: true,
    duplicate: false,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.inserts.length = 0;
  h.events = [];
  h.writeEvent.mockResolvedValue({ status: "normal" });
});

describe("createProposedEvents", () => {
  it("creates only the selected rows, in the profile's zone (RF-19, RF-40, RF-43)", async () => {
    const result = await createProposedEvents([
      row(),
      row({ key: "r2", selected: false }),
      row({
        key: "r3",
        title: " Noche ",
        startDate: "2026-11-21",
        start: "22:00",
        endDate: "2026-11-22",
        end: "06:00",
      }),
    ]);
    expect(result).toEqual({
      results: [
        { key: "r1", ok: true, id: "new-1" },
        { key: "r3", ok: true, id: "new-2" },
      ],
    });
    expect(h.inserts).toEqual([
      expect.objectContaining({
        calendar_id: MINE,
        title: "Turno",
        starts_at: "2026-11-16T07:00:00.000Z",
        ends_at: "2026-11-16T14:00:00.000Z",
        all_day: false,
        created_by: "u1",
      }),
      expect.objectContaining({
        title: "Noche",
        starts_at: "2026-11-21T21:00:00.000Z",
        ends_at: "2026-11-22T05:00:00.000Z",
      }),
    ]);
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("keeps the others when a row cannot be created (RF-46)", async () => {
    const result = await createProposedEvents([
      row({ calendarId: READ_ONLY }),
      row({ key: "r2" }),
      row({ key: "r3", end: "07:00" }),
    ]);
    expect(result).toEqual({
      results: [
        { key: "r1", ok: false, error: "No tienes permiso para hacer esto." },
        { key: "r2", ok: true, id: "new-1" },
        {
          key: "r3",
          ok: false,
          error: "El fin tiene que ser posterior al inicio.",
        },
      ],
    });
  });

  it("creates a duplicate the user selected (RF-38)", async () => {
    const result = await createProposedEvents([row({ duplicate: true })]);
    expect(result).toEqual({ results: [{ key: "r1", ok: true, id: "new-1" }] });
  });

  it("writes a synced calendar in the provider first (RF-44)", async () => {
    h.writeEvent.mockResolvedValueOnce({ status: "done", eventId: "g-1" });
    h.writeEvent.mockResolvedValueOnce({
      status: "failed",
      failure: "transient",
      provider: "google",
    });
    const result = await createProposedEvents([
      row({ calendarId: GOOGLE }),
      row({ key: "r2", calendarId: GOOGLE }),
    ]);
    expect(h.inserts).toEqual([]);
    expect(h.writeEvent.mock.calls[0]![0]).toMatchObject({
      op: "create",
      row: { calendar_id: GOOGLE, starts_at: "2026-11-16T07:00:00.000Z" },
    });
    if (!("results" in result)) throw new Error(result.error);
    expect(result.results[0]).toEqual({ key: "r1", ok: true, id: "g-1" });
    expect(result.results[1]).toMatchObject({ key: "r2", ok: false });
    expect((result.results[1] as { error: string }).error).toMatch(/Google/);
  });

  it("refuses more than 50 rows or rows that do not validate", async () => {
    const many = Array.from({ length: 51 }, (_, i) => row({ key: `r${i}` }));
    for (const bad of [many, [row({ calendarId: "trabajo" })], "x"]) {
      expect(await createProposedEvents(bad)).toEqual({
        error: "La propuesta no es válida. Empieza una nueva.",
      });
    }
    expect(h.inserts).toEqual([]);
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("checkProposal (RF-39)", () => {
  it("marks duplicates again and the calendars that are not writable", async () => {
    h.events = [
      {
        calendarId: MINE,
        startsAt: "2026-11-16T07:00:00.000Z",
        endsAt: "2026-11-16T14:00:00.000Z",
      },
    ];
    const result = await checkProposal([
      row(),
      row({ key: "r2", calendarId: READ_ONLY }),
    ]);
    expect(result).toEqual({
      rows: [
        row({ duplicate: true, selected: false }),
        row({ key: "r2", calendarId: READ_ONLY }),
      ],
      errors: { r2: "No tienes permiso para hacer esto." },
    });
  });
});
