// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 006, T20: deciding on a calendar without owner and closing notices from
// "Mis calendarios" (RF-23 to RF-25).
const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  updateError: null as unknown,
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u1" } } }) },
    rpc: h.rpc,
    from: () => ({
      update: (values: unknown) => {
        h.update(values);
        return {
          eq: async (column: string, value: string) => {
            h.eq(column, value);
            return { error: h.updateError };
          },
        };
      },
    }),
  }),
}));

const { decideOrphanCalendar, dismissNotice } =
  await import("@/app/dashboard/calendars/orphan-actions");

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  h.update.mockReset();
  h.eq.mockReset();
  h.updateError = null;
  h.revalidatePath.mockReset();
});

describe("decideOrphanCalendar (RF-24, RF-25)", () => {
  it("records the decision and refreshes the views", async () => {
    const state = await decideOrphanCalendar("cal-1", true, {}, new FormData());

    expect(h.rpc).toHaveBeenCalledWith("decide_orphan_calendar", {
      p_calendar_id: "cal-1",
      p_keep: true,
    });
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
    expect(state).toEqual({});
  });

  it("explains a calendar that is no longer available (CF404)", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: "CF404" } });

    const state = await decideOrphanCalendar(
      "cal-1",
      false,
      {},
      new FormData(),
    );

    expect(state.formError).toBe("Este calendario ya no está disponible.");
  });
});

describe("dismissNotice (RF-23)", () => {
  it("marks the notice as read and refreshes the views", async () => {
    const state = await dismissNotice("notice-1", {}, new FormData());

    expect(h.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(h.eq).toHaveBeenCalledWith("id", "notice-1");
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
    expect(state).toEqual({});
  });
});
