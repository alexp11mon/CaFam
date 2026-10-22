// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const CALENDAR = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const ME = "33333333-3333-4333-8333-333333333333";

type Result = { data: unknown; error: { code: string } | null };

const state = vi.hoisted(() => ({
  log: [] as unknown[][],
  queue: [] as { data: unknown; error: { code: string } | null }[],
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

// Chainable query builder: awaiting it yields the next queued result.
function builder() {
  const b: Record<string, unknown> = {};
  for (const method of ["update", "delete", "select", "eq"]) {
    b[method] = (...args: unknown[]) => {
      state.log.push([method, ...args]);
      return b;
    };
  }
  b.maybeSingle = () => b;
  b.then = (resolve: (value: Result) => void) =>
    resolve(state.queue.shift() ?? { data: [], error: null });
  return b;
}

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({
    supabase: {
      from: (table: string) => {
        state.log.push(["from", table]);
        return builder();
      },
    },
    userId: "33333333-3333-4333-8333-333333333333",
  }),
}));

const { changeMemberRole, expelMember, leaveCalendar } =
  await import("@/app/dashboard/calendars/[id]/members/actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const OWNER_MESSAGE =
  "El propietario no puede salir de su calendario ni ser expulsado. Para dejar de serlo, borra el calendario.";

beforeEach(() => {
  state.log = [];
  state.queue = [];
  state.revalidated = [];
});

describe("changeMemberRole (RF-25, RF-28)", () => {
  it("updates the role of the member in calendar_members", async () => {
    state.queue = [{ data: [{ role: "editor" }], error: null }];

    const result = await changeMemberRole(
      CALENDAR,
      USER,
      {},
      form({ role: "editor" }),
    );

    expect(result).toEqual({});
    expect(state.log).toContainEqual(["from", "calendar_members"]);
    expect(state.log).toContainEqual(["update", { role: "editor" }]);
    expect(state.log).toContainEqual(["eq", "calendar_id", CALENDAR]);
    expect(state.log).toContainEqual(["eq", "user_id", USER]);
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("rejects the owner role before the database", async () => {
    const result = await changeMemberRole(
      CALENDAR,
      USER,
      {},
      form({ role: "owner" }),
    );

    expect(result.formError).toBe("Elige un rol.");
    expect(state.log).toEqual([]);
  });

  it("gives the owner message when the row is the owner's", async () => {
    state.queue = [
      { data: [], error: null },
      { data: { role: "owner" }, error: null },
    ];

    const result = await changeMemberRole(
      CALENDAR,
      USER,
      {},
      form({ role: "viewer" }),
    );

    expect(result.formError).toBe(OWNER_MESSAGE);
  });

  it("explains zero rows as no permission or already gone", async () => {
    state.queue = [
      { data: [], error: null },
      { data: { role: "viewer" }, error: null },
    ];
    expect(
      (await changeMemberRole(CALENDAR, USER, {}, form({ role: "editor" })))
        .formError,
    ).toBe("No tienes permiso para hacer esto.");

    state.queue = [
      { data: [], error: null },
      { data: null, error: null },
    ];
    expect(
      (await changeMemberRole(CALENDAR, USER, {}, form({ role: "editor" })))
        .formError,
    ).toBe("Este elemento ya no existe.");
  });

  it("maps database errors", async () => {
    state.queue = [{ data: null, error: { code: "42501" } }];

    expect(
      (await changeMemberRole(CALENDAR, USER, {}, form({ role: "editor" })))
        .formError,
    ).toBe("No tienes permiso para hacer esto.");
  });
});

describe("expelMember (RF-26, RF-28)", () => {
  it("deletes the member row", async () => {
    state.queue = [{ data: [{ user_id: USER }], error: null }];

    expect(await expelMember(CALENDAR, USER)).toEqual({});
    expect(state.log).toContainEqual(["delete"]);
    expect(state.log).toContainEqual(["eq", "user_id", USER]);
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("gives the owner message when the row is the owner's", async () => {
    state.queue = [
      { data: [], error: null },
      { data: { role: "owner" }, error: null },
    ];

    expect((await expelMember(CALENDAR, USER)).formError).toBe(OWNER_MESSAGE);
  });

  it("does not call the database for malformed ids", async () => {
    expect((await expelMember("nope", USER)).formError).toBe(
      "Este elemento ya no existe.",
    );
    expect(state.log).toEqual([]);
  });
});

describe("leaveCalendar (RF-27, RF-28)", () => {
  it("deletes the own row and goes back to the panel", async () => {
    state.queue = [{ data: [{ user_id: ME }], error: null }];

    // The list of calendars lives in "Mis calendarios" (spec 005 RF-21).
    await expect(leaveCalendar(CALENDAR)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/calendars$/,
    );

    expect(state.log).toContainEqual(["eq", "user_id", ME]);
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("the owner gets the owner message and stays", async () => {
    state.queue = [
      { data: [], error: null },
      { data: { role: "owner" }, error: null },
    ];

    expect((await leaveCalendar(CALENDAR)).formError).toBe(OWNER_MESSAGE);
    expect(state.revalidated).toEqual([]);
  });
});
