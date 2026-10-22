// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const state = vi.hoisted(() => ({
  rpcCalls: [] as { name: string; args: unknown }[],
  rpcResult: { data: "result-id", error: null } as {
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

const { mergeCalendars } = await import("@/app/dashboard/calendars/actions");

const EMPTY = { sourceIds: "", targetId: "", newName: "", newColor: "" };

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }
  return data;
}

beforeEach(() => {
  state.rpcCalls = [];
  state.revalidated = [];
  state.rpcResult = { data: "result-id", error: null };
});

describe("mergeCalendars action (RF-49, RF-50, RF-53)", () => {
  it("merges into one of the chosen calendars and goes back to the panel", async () => {
    await expect(
      mergeCalendars(
        { values: EMPTY },
        form({ sourceIds: [A, B], targetId: B, newName: "", newColor: "" }),
      ),
    ).rejects.toThrow(/^REDIRECT:\/dashboard\/calendars$/);

    expect(state.rpcCalls).toEqual([
      {
        name: "merge_calendars",
        args: { p_source_ids: [A, B], p_target_id: B },
      },
    ]);
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("merges into a new calendar with the given name and color", async () => {
    await expect(
      mergeCalendars(
        { values: EMPTY },
        form({
          sourceIds: [A, B, C],
          targetId: "",
          newName: " Universidad ",
          newColor: "#a0c4ff",
        }),
      ),
    ).rejects.toThrow(/^REDIRECT:\/dashboard\/calendars$/);

    expect(state.rpcCalls[0]?.args).toEqual({
      p_source_ids: [A, B, C],
      p_name: "Universidad",
      p_color: "#A0C4FF",
    });
  });

  it("reports field errors without calling the database", async () => {
    const result = await mergeCalendars(
      { values: EMPTY },
      form({ sourceIds: [A], targetId: "", newName: "", newColor: "" }),
    );

    expect(result.fieldErrors?.sourceIds).toBe(
      "Elige al menos dos calendarios.",
    );
    expect(result.values.sourceIds).toBe(A);
    expect(state.rpcCalls).toEqual([]);
  });

  it("translates a permission error and keeps what was chosen", async () => {
    state.rpcResult = { data: null, error: { code: "42501" } };

    const result = await mergeCalendars(
      { values: EMPTY },
      form({ sourceIds: [A, B], targetId: A, newName: "", newColor: "" }),
    );

    expect(result.formError).toBe(
      "Solo puedes juntar calendarios de los que eres propietario.",
    );
    expect(result.values).toMatchObject({
      sourceIds: `${A},${B}`,
      targetId: A,
    });
    expect(state.revalidated).toEqual([]);
  });

  it("falls back to the connection message for unknown errors", async () => {
    state.rpcResult = { data: null, error: { code: "XX000" } };

    const result = await mergeCalendars(
      { values: EMPTY },
      form({ sourceIds: [A, B], targetId: A, newName: "", newColor: "" }),
    );

    expect(result.formError).toMatch(/No se ha podido conectar/);
  });
});
