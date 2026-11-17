// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Spec 034 D13: with no session the offline actions answer, they never
// redirect, so the browser keeps its changes (RF-63).
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: null, error: null }) },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { applyOfflineChange, loadOfflineSnapshot } =
  await import("@/app/dashboard/offline-actions");

describe("offline actions without a session", () => {
  it("loadOfflineSnapshot answers unauthenticated", async () => {
    expect(await loadOfflineSnapshot()).toEqual({ unauthenticated: true });
  });

  it("applyOfflineChange answers unauthenticated for a valid change", async () => {
    const change = {
      type: "item.move",
      noteId: "8d8f4a52-6f1e-4c47-9a5b-1d1f6b9f3e10",
      positions: [{ id: "2b7f1c0e-3d4a-4f5b-8c6d-7e8f9a0b1c2d", position: 0 }],
    };
    expect(await applyOfflineChange(change)).toEqual({ unauthenticated: true });
  });

  it("an invalid change is rejected before anything else", async () => {
    expect(await applyOfflineChange({ type: "event.create" })).toMatchObject({
      status: "rejected",
    });
  });
});
