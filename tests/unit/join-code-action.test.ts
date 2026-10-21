// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpcCalls: [] as { name: string; args: unknown }[],
  rpcResult: { data: null, error: null } as {
    data: { status: string; calendar_id: string | null }[] | null;
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

const { joinWithCode } = await import("@/app/dashboard/join/actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const INITIAL = { values: { code: "", pin: "" } };

function answer(status: string, calendarId: string | null = null) {
  state.rpcResult = {
    data: [{ status, calendar_id: calendarId }],
    error: null,
  };
}

beforeEach(() => {
  state.rpcCalls = [];
  state.revalidated = [];
});

describe("joinWithCode action (RF-19..RF-23)", () => {
  it.each(["ok", "member"])("%s goes to the calendar views", async (status) => {
    answer(status, "calendar-id");

    await expect(
      joinWithCode(INITIAL, form({ code: "abcd2345", pin: "482915" })),
    ).rejects.toThrow("REDIRECT:/dashboard/calendar");

    expect(state.rpcCalls).toEqual([
      {
        name: "join_with_code",
        args: { p_code: "ABCD2345", p_pin: "482915" },
      },
    ]);
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("invalid returns the incorrect message and drops the PIN (RF-20)", async () => {
    answer("invalid");

    const result = await joinWithCode(
      INITIAL,
      form({ code: "abcd2345", pin: "000000" }),
    );

    expect(result).toEqual({
      formError: "ID o PIN incorrectos.",
      values: { code: "ABCD2345", pin: "" },
    });
    expect(state.revalidated).toEqual([]);
  });

  it("limited returns the block message (RF-21, RF-22)", async () => {
    answer("limited");

    const result = await joinWithCode(
      INITIAL,
      form({ code: "ABCD2345", pin: "000000" }),
    );

    expect(result.formError).toBe(
      "Demasiados intentos. Espera 15 minutos y vuelve a probar.",
    );
  });

  it("asks for missing fields without calling the database", async () => {
    const result = await joinWithCode(INITIAL, form({ code: "", pin: "" }));

    expect(result.fieldErrors).toEqual({
      code: "Escribe el ID del calendario.",
      pin: "Escribe el PIN.",
    });
    expect(state.rpcCalls).toEqual([]);
  });

  it("maps database errors", async () => {
    state.rpcResult = { data: null, error: { code: "XX000" } };

    const result = await joinWithCode(
      INITIAL,
      form({ code: "ABCD2345", pin: "482915" }),
    );

    expect(result.formError).toContain("No se ha podido conectar");
  });
});
