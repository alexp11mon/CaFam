// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";

const state = vi.hoisted(() => ({
  rpcCalls: [] as { name: string; args: unknown }[],
  rpcResult: { data: "calendar-id", error: null } as {
    data: string | null;
    error: { code: string } | null;
  },
  revalidated: [] as unknown[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => state.revalidated.push(args),
}));

// redirect() throws in Next to stop rendering; do the same so the code after it never runs.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({
    supabase: {
      rpc: async (name: string, args: unknown) => {
        state.rpcCalls.push({ name, args });
        return state.rpcResult;
      },
    },
    userId: "user",
  }),
}));

const { acceptInvite } = await import("@/app/invite/[token]/actions");

beforeEach(() => {
  state.rpcCalls = [];
  state.revalidated = [];
  state.rpcResult = { data: "calendar-id", error: null };
});

describe("acceptInvite action (RF-6, RF-8)", () => {
  it("calls accept_invite and goes to the calendar views", async () => {
    await expect(acceptInvite(TOKEN)).rejects.toThrow(
      "REDIRECT:/dashboard/calendar",
    );

    expect(state.rpcCalls).toEqual([
      { name: "accept_invite", args: { p_token: TOKEN } },
    ]);
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("maps CF404 to the single invalid-invite message", async () => {
    state.rpcResult = { data: null, error: { code: "CF404" } };

    expect(await acceptInvite(TOKEN)).toEqual({
      formError: "Esta invitación ya no es válida.",
    });
    expect(state.revalidated).toEqual([]);
  });

  it("does not call the database for a malformed token", async () => {
    expect(await acceptInvite("short")).toEqual({
      formError: "Esta invitación ya no es válida.",
    });
    expect(state.rpcCalls).toEqual([]);
  });
});
