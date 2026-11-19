import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 046, T3: a token of the server as a step of the stack (RF-11, RF-12,
// RF-16).
const h = vi.hoisted(() => ({
  undoAction: vi.fn(),
  undoChange: vi.fn(),
}));

vi.mock("@/app/dashboard/events/quick-actions", () => ({
  undoAction: h.undoAction,
}));
vi.mock("@/lib/offline/queue-store", () => ({ undoChange: h.undoChange }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

const { tokenStep } = await import("@/components/calendar/use-undo-toast");

beforeEach(() => {
  h.undoAction.mockReset();
  h.undoChange.mockReset();
});

describe("tokenStep", () => {
  it("undoes, refreshes and answers with the step that redoes", async () => {
    const refresh = vi.fn();
    h.undoAction
      .mockResolvedValueOnce({
        ok: true,
        inverse: { kind: "delete", id: "e1" },
      })
      .mockResolvedValueOnce({ ok: true });
    const result = await tokenStep(
      { kind: "restore", trashId: "t1" },
      refresh,
    )();
    expect(result.ok && result.inverse).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);

    const redo = result.ok ? await result.inverse!() : null;
    expect(h.undoAction).toHaveBeenLastCalledWith({ kind: "delete", id: "e1" });
    expect(redo).toEqual({ ok: true });
  });

  it("passes on why it could not (RF-13)", async () => {
    h.undoAction.mockResolvedValue({ ok: false, error: "cambiado" });
    expect(await tokenStep({ kind: "unpaste", id: "e1" }, () => {})()).toEqual({
      ok: false,
      error: "cambiado",
    });
  });

  it("a change still in the queue leaves it, without a server call (RF-16)", async () => {
    h.undoChange.mockResolvedValue(true);
    expect(
      await tokenStep({ kind: "offline", changeId: "c1" }, () => {})(),
    ).toEqual({ ok: true });
    expect(h.undoAction).not.toHaveBeenCalled();
  });
});
