// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const CALENDAR = "11111111-1111-4111-8111-111111111111";
const INVITE = "22222222-2222-4222-8222-222222222222";
const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";

const state = vi.hoisted(() => ({
  rpcCalls: [] as { name: string; args: unknown }[],
  rpcResult: { data: null, error: null } as {
    data: string | null;
    error: { code: string } | null;
  },
  revalidated: [] as unknown[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => state.revalidated.push(args),
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-host": "app.example.com",
      "x-forwarded-proto": "https",
    }),
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

const { createInvite, revokeInvite } =
  await import("@/app/dashboard/calendars/[id]/share/actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const INITIAL = { values: { role: "viewer", maxUses: "1" } };

beforeEach(() => {
  state.rpcCalls = [];
  state.revalidated = [];
  state.rpcResult = { data: TOKEN, error: null };
});

describe("createInvite action (RF-1..RF-3)", () => {
  it("calls create_invite and builds the link from the request headers", async () => {
    const result = await createInvite(
      CALENDAR,
      INITIAL,
      form({ role: "editor", maxUses: "3" }),
    );

    expect(state.rpcCalls).toEqual([
      {
        name: "create_invite",
        args: { p_calendar_id: CALENDAR, p_role: "editor", p_max_uses: 3 },
      },
    ]);
    expect(result.inviteUrl).toBe(`https://app.example.com/invite/${TOKEN}`);
    expect(result.formError).toBeUndefined();
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("reports the uses next to the field without calling the database (RF-3)", async () => {
    const result = await createInvite(
      CALENDAR,
      INITIAL,
      form({ role: "viewer", maxUses: "21" }),
    );

    expect(result.fieldErrors?.maxUses).toBe("Elige entre 1 y 20 usos.");
    expect(result.values).toEqual({ role: "viewer", maxUses: "21" });
    expect(state.rpcCalls).toEqual([]);
  });

  it("rejects the owner role before the database", async () => {
    const result = await createInvite(
      CALENDAR,
      INITIAL,
      form({ role: "owner", maxUses: "1" }),
    );

    expect(result.fieldErrors?.role).toBe("Elige un rol.");
    expect(state.rpcCalls).toEqual([]);
  });

  it("maps errors and never returns the token when it fails", async () => {
    state.rpcResult = { data: TOKEN, error: { code: "42501" } };

    const result = await createInvite(
      CALENDAR,
      INITIAL,
      form({ role: "viewer", maxUses: "1" }),
    );

    expect(result.formError).toBe("No tienes permiso para hacer esto.");
    expect(result.inviteUrl).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(state.revalidated).toEqual([]);
  });

  it("does not call the database for a malformed calendar id", async () => {
    const result = await createInvite(
      "nope",
      INITIAL,
      form({ role: "viewer", maxUses: "1" }),
    );

    expect(result.formError).toBe("Este elemento ya no existe.");
    expect(state.rpcCalls).toEqual([]);
  });
});

describe("revokeInvite action (RF-12)", () => {
  it("calls revoke_invite", async () => {
    state.rpcResult = { data: null, error: null };

    const result = await revokeInvite(INVITE);

    expect(result).toEqual({});
    expect(state.rpcCalls).toEqual([
      { name: "revoke_invite", args: { p_invite_id: INVITE } },
    ]);
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("maps a permission error", async () => {
    state.rpcResult = { data: null, error: { code: "42501" } };

    expect(await revokeInvite(INVITE)).toEqual({
      formError: "No tienes permiso para hacer esto.",
    });
  });

  it("does not call the database for a malformed id", async () => {
    expect(await revokeInvite("nope")).toEqual({
      formError: "Este elemento ya no existe.",
    });
    expect(state.rpcCalls).toEqual([]);
  });
});
