// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 005, T7: saving the accent in the user's own profile row
// (RF-8, RF-12, RF-13; plan "Server Actions").
const ME = "99999999-9999-4999-8999-999999999999";

const state = vi.hoisted(() => ({
  updates: [] as { table: string; values: unknown; eq: [string, string] }[],
  result: { data: [{ id: "me" }], error: null } as {
    data: unknown[] | null;
    error: { code: string } | null;
  },
  throws: false,
  revalidated: [] as unknown[][],
}));

function fakeSupabase() {
  return {
    from(table: string) {
      return {
        update(values: unknown) {
          return {
            eq(column: string, value: string) {
              return {
                select: async () => {
                  state.updates.push({ table, values, eq: [column, value] });
                  if (state.throws) throw new TypeError("fetch failed");
                  return state.result;
                },
              };
            },
          };
        },
      };
    },
  };
}

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => state.revalidated.push(args),
}));

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: fakeSupabase(), userId: ME }),
}));

const { setAccent } = await import("@/app/dashboard/settings/actions");

beforeEach(() => {
  state.updates = [];
  state.result = { data: [{ id: ME }], error: null };
  state.throws = false;
  state.revalidated = [];
});

describe("setAccent (RF-8)", () => {
  it("saves the accent in the user's own row and refreshes the frame", async () => {
    const result = await setAccent("green");

    expect(result).toEqual({});
    expect(state.updates).toEqual([
      { table: "profiles", values: { accent: "green" }, eq: ["id", ME] },
    ]);
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("rejects a value outside the six without touching the database", async () => {
    const result = await setAccent("pink");

    expect(result.error).toBe("Elige uno de los colores disponibles.");
    expect(state.updates).toEqual([]);
  });
});

describe("setAccent errors (RF-12)", () => {
  it("explains that nothing was saved when no row changes", async () => {
    state.result = { data: [], error: null };

    const result = await setAccent("blue");

    expect(result.error).toBe(
      "No se ha podido guardar el color. Inténtalo de nuevo.",
    );
    expect(state.revalidated).toEqual([]);
  });

  it("explains that nothing was saved on a database error", async () => {
    state.result = { data: null, error: { code: "23514" } };

    const result = await setAccent("blue");

    expect(result.error).toBe(
      "No se ha podido guardar el color. Inténtalo de nuevo.",
    );
  });

  it("uses the connection message on a network failure", async () => {
    state.throws = true;

    const result = await setAccent("blue");

    expect(result.error).toBe(
      "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
    );
  });
});
