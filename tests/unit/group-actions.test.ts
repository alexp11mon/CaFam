// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 007, T13: Server Actions of the calendar groups (RF-35 to RF-41).
const ME = "99999999-9999-4999-8999-999999999999";
const GROUP = "11111111-1111-4111-8111-111111111111";
const CAL_A = "22222222-2222-4222-8222-222222222222";
const CAL_B = "33333333-3333-4333-8333-333333333333";

interface Call {
  table: string;
  op: string;
  args: unknown[];
  filters: [string, unknown][];
}

const state = vi.hoisted(() => ({
  calls: [] as Call[],
  // Result of the awaited query, by "table.op".
  results: {} as Record<string, { data?: unknown; error?: unknown }>,
}));

function fakeSupabase() {
  return {
    from(table: string) {
      const call: Call = { table, op: "", args: [], filters: [] };
      const builder = {
        insert: (...args: unknown[]) => start("insert", args),
        update: (...args: unknown[]) => start("update", args),
        delete: () => start("delete", []),
        upsert: (...args: unknown[]) => start("upsert", args),
        select: () => (call.op ? builder : start("select", [])),
        eq: (column: string, value: unknown) => {
          call.filters.push([column, value]);
          return builder;
        },
        maybeSingle: () => builder,
        then: (resolve: (value: unknown) => void) =>
          resolve({
            data: null,
            error: null,
            ...state.results[`${table}.${call.op}`],
          }),
      };
      function start(op: string, args: unknown[]) {
        call.op = op;
        call.args = args;
        state.calls.push(call);
        return builder;
      }
      return builder;
    },
  };
}

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: fakeSupabase(), userId: ME }),
}));

const {
  assignToGroup,
  createGroup,
  deleteGroup,
  renameGroup,
  setGroupVisibility,
} = await import("@/app/dashboard/calendars/group-actions");

function form(name: string) {
  const data = new FormData();
  data.set("name", name);
  return data;
}

const EMPTY = { values: { name: "" } };

beforeEach(() => {
  state.calls = [];
  state.results = {};
  revalidatePath.mockClear();
});

describe("createGroup (RF-35)", () => {
  it("creates the group for the user with the trimmed name", async () => {
    const result = await createGroup(EMPTY, form("  Trabajo "));

    expect(result).toEqual({ values: { name: "" } });
    expect(state.calls[0]).toMatchObject({
      table: "calendar_groups",
      op: "insert",
      args: [{ user_id: ME, name: "Trabajo" }],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("validates the name with zod without touching the database", async () => {
    const empty = await createGroup(EMPTY, form("   "));
    const long = await createGroup(EMPTY, form("x".repeat(41)));

    expect(empty.fieldErrors?.name).toBeTruthy();
    expect(long.fieldErrors?.name).toBeTruthy();
    expect(state.calls).toEqual([]);
  });

  it("explains a repeated name next to the field", async () => {
    state.results["calendar_groups.insert"] = { error: { code: "23505" } };

    const result = await createGroup(EMPTY, form("trabajo"));

    expect(result.fieldErrors?.name).toBe("Ya tienes un grupo con ese nombre.");
    expect(result.values.name).toBe("trabajo");
  });
});

describe("renameGroup and deleteGroup (RF-41)", () => {
  it("renames only that group", async () => {
    state.results["calendar_groups.update"] = { data: [{ id: GROUP }] };

    const result = await renameGroup(GROUP, EMPTY, form("Ocio"));

    expect(result).toEqual({ values: { name: "Ocio" } });
    expect(state.calls[0]).toMatchObject({
      op: "update",
      args: [{ name: "Ocio" }],
      filters: [["id", GROUP]],
    });
  });

  it("says the group is gone when nothing was renamed (RLS hides it)", async () => {
    state.results["calendar_groups.update"] = { data: [] };

    const result = await renameGroup(GROUP, EMPTY, form("Ocio"));

    expect(result.formError).toBe("Ese grupo ya no existe.");
  });

  it("deletes the group; its calendars stay (the database sets them free)", async () => {
    state.results["calendar_groups.delete"] = { data: [{ id: GROUP }] };

    expect(await deleteGroup(GROUP)).toEqual({});
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({
      table: "calendar_groups",
      op: "delete",
      filters: [["id", GROUP]],
    });
  });

  it("rejects malformed ids", async () => {
    expect((await deleteGroup("x")).formError).toBe("Ese grupo ya no existe.");
    expect((await renameGroup("x", EMPTY, form("Ocio"))).formError).toBe(
      "Ese grupo ya no existe.",
    );
    expect(state.calls).toEqual([]);
  });
});

describe("assignToGroup (RF-36, RF-37)", () => {
  it("writes the group in the user's own preference row", async () => {
    expect(await assignToGroup(CAL_A, GROUP)).toEqual({});
    expect(state.calls[0]).toMatchObject({
      table: "calendar_preferences",
      op: "upsert",
      args: [
        { user_id: ME, calendar_id: CAL_A, group_id: GROUP },
        { onConflict: "user_id,calendar_id" },
      ],
    });
  });

  it("takes a calendar out of its group with null", async () => {
    await assignToGroup(CAL_A, null);

    expect(state.calls[0].args[0]).toEqual({
      user_id: ME,
      calendar_id: CAL_A,
      group_id: null,
    });
  });

  it("translates a group of someone else or already deleted", async () => {
    state.results["calendar_preferences.upsert"] = { error: { code: "23503" } };

    const result = await assignToGroup(CAL_A, GROUP);

    expect(result.error).toBe("Ese grupo ya no existe.");
  });

  it("rejects malformed ids", async () => {
    expect((await assignToGroup("x", GROUP)).error).toBeTruthy();
    expect((await assignToGroup(CAL_A, "x")).error).toBeTruthy();
    expect(state.calls).toEqual([]);
  });
});

describe("setGroupVisibility (RF-39)", () => {
  it("shows or hides every calendar of the group, read from the database", async () => {
    state.results["calendar_preferences.select"] = {
      data: [{ calendar_id: CAL_A }, { calendar_id: CAL_B }],
    };

    expect(await setGroupVisibility(GROUP, false)).toEqual({});

    expect(state.calls[0]).toMatchObject({
      op: "select",
      filters: [
        ["user_id", ME],
        ["group_id", GROUP],
      ],
    });
    expect(state.calls[1]).toMatchObject({
      op: "upsert",
      args: [
        [
          { user_id: ME, calendar_id: CAL_A, visible: false },
          { user_id: ME, calendar_id: CAL_B, visible: false },
        ],
        { onConflict: "user_id,calendar_id" },
      ],
    });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("does nothing for an empty group", async () => {
    state.results["calendar_preferences.select"] = { data: [] };

    expect(await setGroupVisibility(GROUP, true)).toEqual({});
    expect(state.calls).toHaveLength(1);
  });
});
