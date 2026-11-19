import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventData, OfflineChange } from "@/lib/offline/outbox";
import { inverseOf } from "@/lib/offline/undo-sent";

// Spec 046, T5: undoing a change made offline (RF-16). Still in the queue it
// leaves it; already sent, it is undone online through its inverse.
const h = vi.hoisted(() => ({
  undoChange: vi.fn(),
  apply: vi.fn(),
  online: true,
}));

vi.mock("@/app/dashboard/events/quick-actions", () => ({
  undoAction: vi.fn(),
}));
vi.mock("@/app/dashboard/offline-actions", () => ({
  applyOfflineChange: h.apply,
}));
vi.mock("@/lib/offline/queue-store", () => ({ undoChange: h.undoChange }));
vi.mock("@/lib/offline/connection", () => ({ isOnline: () => h.online }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

const { tokenStep } = await import("@/components/calendar/use-undo-toast");

const BEFORE = {
  calendarId: "c1",
  title: "Dentista",
  startsAt: "2026-11-20T09:00:00Z",
  endsAt: "2026-11-20T10:00:00Z",
  allDay: false,
} as EventData;
const AFTER = { ...BEFORE, startsAt: "2026-11-20T11:00:00Z" } as EventData;
const MOVE: OfflineChange = {
  type: "event.update",
  id: "e1",
  base: BEFORE,
  data: AFTER,
};

beforeEach(() => {
  h.undoChange.mockReset();
  h.apply.mockReset();
  h.online = true;
});

describe("inverseOf", () => {
  it("swaps an update, deletes a creation and creates a deletion again", () => {
    expect(inverseOf(MOVE)).toEqual({
      type: "event.update",
      id: "e1",
      base: AFTER,
      data: BEFORE,
    });
    expect(inverseOf({ type: "event.create", id: "e2", data: AFTER })).toEqual({
      type: "event.delete",
      id: "e2",
      base: AFTER,
    });
    expect(inverseOf({ type: "event.delete", id: "e3", base: BEFORE })).toEqual(
      { type: "event.create", id: "e3", data: BEFORE },
    );
  });

  it("has none for a series", () => {
    expect(inverseOf({ ...MOVE, repeat: "weekly" })).toBeNull();
  });
});

describe("undo of a change made offline", () => {
  const token = { kind: "offline" as const, changeId: "q1", change: MOVE };

  it("still in the queue: it leaves it, without the server", async () => {
    h.undoChange.mockResolvedValue(true);
    expect(await tokenStep(token, () => {})()).toEqual({ ok: true });
    expect(h.apply).not.toHaveBeenCalled();
  });

  it("already sent: undone online, and redone with its inverse", async () => {
    h.undoChange.mockResolvedValue(false);
    h.apply.mockResolvedValue({ status: "applied" });
    const refresh = vi.fn();
    const result = await tokenStep(token, refresh)();
    expect(h.apply).toHaveBeenLastCalledWith(inverseOf(MOVE));
    expect(refresh).toHaveBeenCalled();

    const redo = result.ok ? await result.inverse!() : null;
    expect(h.apply).toHaveBeenLastCalledWith(MOVE);
    expect(redo?.ok).toBe(true);
  });

  it("already sent and changed by someone else: not undone (RF-13)", async () => {
    h.undoChange.mockResolvedValue(false);
    h.apply.mockResolvedValue({ status: "conflict", server: {} });
    expect(await tokenStep(token, () => {})()).toEqual({
      ok: false,
      error: "Este evento ha cambiado entretanto; no se ha deshecho.",
    });
  });

  it("already sent and still offline: it waits for the network", async () => {
    h.undoChange.mockResolvedValue(false);
    h.online = false;
    expect(await tokenStep(token, () => {})()).toEqual({
      ok: false,
      error: "Ya no se puede deshacer.",
    });
    expect(h.apply).not.toHaveBeenCalled();
  });
});
