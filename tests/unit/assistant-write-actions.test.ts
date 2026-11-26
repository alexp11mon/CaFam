// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 036, T5: "Confirmar" and "Deshacer" validate what the browser sends
// and use the profile's zone (RF-24a, RF-33 to RF-37; plan D4).

const mocks = vi.hoisted(() => ({
  applyPendingChange: vi.fn(),
  applyPendingDelete: vi.fn(),
  applyPendingSeries: vi.fn(),
  undoWrite: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/calendar/queries", async (actual) => ({
  ...(await actual<object>()),
  requireActionUser: async () => ({ supabase: {}, userId: "u1" }),
  getProfileTimeZone: async () => "Atlantic/Canary",
}));
vi.mock("@/app/dashboard/assistant/change-writes", async (actual) => ({
  ...(await actual<object>()),
  applyPendingChange: mocks.applyPendingChange,
  applyPendingDelete: mocks.applyPendingDelete,
  applyPendingSeries: mocks.applyPendingSeries,
  undoWrite: mocks.undoWrite,
}));
vi.mock("@/app/dashboard/events/event-writes", () => ({
  refresh: mocks.refresh,
}));

const { confirmChange, confirmDelete, confirmSeries, undoAssistantAction } =
  await import("@/app/dashboard/assistant/write-actions");

const ID = "11111111-1111-4111-8111-111111111111";
const change = {
  id: ID,
  scope: null,
  updatedAt: "2026-11-18T08:00:00+00:00",
  fields: {
    title: "Dentista",
    description: null,
    location: null,
    calendarId: "22222222-2222-4222-8222-222222222222",
    startsAt: "2026-11-20T17:00:00.000Z",
    endsAt: "2026-11-20T18:00:00.000Z",
    allDay: false,
  },
};

beforeEach(() => vi.clearAllMocks());

describe("confirmChange", () => {
  it("applies a valid change in the profile's zone and refreshes", async () => {
    mocks.applyPendingChange.mockResolvedValue({ ok: true });
    expect(await confirmChange(change)).toEqual({ ok: true });
    expect(mocks.applyPendingChange).toHaveBeenCalledWith(
      {},
      "Atlantic/Canary",
      change,
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses what does not validate, without writing", async () => {
    expect(
      await confirmChange({
        ...change,
        fields: { ...change.fields, endsAt: change.fields.startsAt },
      }),
    ).toEqual({
      ok: false,
      error: "Este cambio ya no es válido. Pídemelo otra vez.",
    });
    expect(mocks.applyPendingChange).not.toHaveBeenCalled();
  });

  it("does not refresh when nothing was written", async () => {
    mocks.applyPendingChange.mockResolvedValue({ ok: false, error: "x" });
    expect(await confirmChange(change)).toEqual({ ok: false, error: "x" });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("undoAssistantAction", () => {
  it("undoes a valid token", async () => {
    mocks.undoWrite.mockResolvedValue({ ok: true });
    const token = { kind: "uncreate", id: ID, updatedAt: "x" };
    expect(await undoAssistantAction(token)).toEqual({ ok: true });
    expect(mocks.undoWrite).toHaveBeenCalledWith({}, "Atlantic/Canary", token);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses a malformed token", async () => {
    expect(
      await undoAssistantAction({ kind: "restore", trashId: "x" }),
    ).toEqual({ ok: false, error: "Ya no se puede deshacer." });
    expect(mocks.undoWrite).not.toHaveBeenCalled();
  });

  it("restores a deletion from the trash (spec 052 RF-3)", async () => {
    mocks.undoWrite.mockResolvedValue({ ok: true });
    const token = { kind: "restore", trashId: ID };
    expect(await undoAssistantAction(token)).toEqual({ ok: true });
    expect(mocks.undoWrite).toHaveBeenCalledWith({}, "Atlantic/Canary", token);
  });
});

// Spec 052 T2, T3: "Borrar" and "Crear" of Venito's cards.
describe("confirmDelete", () => {
  const remove = { id: ID, scope: "all", updatedAt: "x" };

  it("deletes what validates and refreshes", async () => {
    const undo = { kind: "restore", trashId: ID };
    mocks.applyPendingDelete.mockResolvedValue({ ok: true, undo });
    expect(await confirmDelete(remove)).toEqual({ ok: true, undo });
    expect(mocks.applyPendingDelete).toHaveBeenCalledWith({}, remove);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses what does not validate", async () => {
    expect(await confirmDelete({ ...remove, scope: "some" })).toEqual({
      ok: false,
      error: "Este cambio ya no es válido. Pídemelo otra vez.",
    });
    expect(mocks.applyPendingDelete).not.toHaveBeenCalled();
  });
});

describe("confirmSeries", () => {
  const series = {
    calendarId: "22222222-2222-4222-8222-222222222222",
    title: "Inglés",
    description: null,
    location: null,
    startsAt: "2026-11-24T17:00:00.000Z",
    endsAt: "2026-11-24T18:00:00.000Z",
    allDay: false,
    rule: {
      freq: "weekly",
      interval: 1,
      byDay: ["TU"],
      end: { kind: "never" },
    },
  };

  it("creates the series in the profile's zone", async () => {
    mocks.applyPendingSeries.mockResolvedValue({ ok: true });
    expect(await confirmSeries(series)).toEqual({ ok: true });
    expect(mocks.applyPendingSeries).toHaveBeenCalledWith(
      {},
      "u1",
      "Atlantic/Canary",
      series,
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses a rule CaFam cannot keep, without writing (RF-5)", async () => {
    expect(
      await confirmSeries({ ...series, rule: { freq: "hourly", interval: 1 } }),
    ).toMatchObject({ ok: false });
    expect(mocks.applyPendingSeries).not.toHaveBeenCalled();
  });
});
