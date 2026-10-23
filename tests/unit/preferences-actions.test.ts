// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const ME = "99999999-9999-4999-8999-999999999999";

interface UpsertCall {
  table: string;
  rows: unknown;
  options: unknown;
}

const state = vi.hoisted(() => ({
  upserts: [] as UpsertCall[],
  upsertError: null as { code: string } | null,
  ownedCalendars: [] as { id: string }[],
}));

function fakeSupabase() {
  return {
    from(table: string) {
      return {
        upsert: async (rows: unknown, options: unknown) => {
          state.upserts.push({ table, rows, options });
          return { error: state.upsertError };
        },
        select: () => ({
          eq: async () => ({ data: state.ownedCalendars, error: null }),
        }),
      };
    },
  };
}

// Outside a Next request revalidatePath has no store to write to.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: fakeSupabase(), userId: ME }),
}));

const { saveOrder, setCalendarVisibility, setPersonVisibility } =
  await import("@/app/dashboard/calendar/preferences-actions");

beforeEach(() => {
  state.upserts = [];
  state.upsertError = null;
  state.ownedCalendars = [];
});

describe("setCalendarVisibility (RF-43, RF-46)", () => {
  it("upserts only the user's own preference row, keeping the saved position", async () => {
    const result = await setCalendarVisibility(UUID_A, false);

    expect(result).toEqual({});
    expect(state.upserts).toEqual([
      {
        table: "calendar_preferences",
        rows: { user_id: ME, calendar_id: UUID_A, visible: false },
        options: { onConflict: "user_id,calendar_id" },
      },
    ]);
  });

  it("rejects a malformed calendar id without touching the database", async () => {
    const result = await setCalendarVisibility("no-es-uuid", true);

    expect(result.error).toBe("Este elemento ya no existe.");
    expect(state.upserts).toEqual([]);
  });

  it("translates database errors", async () => {
    state.upsertError = { code: "42501" };

    const result = await setCalendarVisibility(UUID_A, true);

    expect(result.error).toBe("No tienes permiso para hacer esto.");
  });
});

describe("setPersonVisibility (RF-44)", () => {
  it("sets every calendar of that person in one upsert", async () => {
    state.ownedCalendars = [{ id: UUID_A }, { id: UUID_B }];

    const result = await setPersonVisibility(UUID_C, false);

    expect(result).toEqual({});
    expect(state.upserts).toEqual([
      {
        table: "calendar_preferences",
        rows: [
          { user_id: ME, calendar_id: UUID_A, visible: false },
          { user_id: ME, calendar_id: UUID_B, visible: false },
        ],
        options: { onConflict: "user_id,calendar_id" },
      },
    ]);
  });

  it("does nothing when the person has no calendars the user can see", async () => {
    const result = await setPersonVisibility(UUID_C, true);

    expect(result).toEqual({});
    expect(state.upserts).toEqual([]);
  });
});

describe("saveOrder (RF-45)", () => {
  it("saves the position of every person and calendar as the user's own rows", async () => {
    const result = await saveOrder({
      people: [UUID_B, ME],
      calendars: { [ME]: [UUID_A, UUID_C], [UUID_B]: [UUID_B] },
    });

    expect(result).toEqual({});
    expect(state.upserts).toEqual([
      {
        table: "person_preferences",
        rows: [
          { user_id: ME, person_id: UUID_B, position: 0 },
          { user_id: ME, person_id: ME, position: 1 },
        ],
        options: { onConflict: "user_id,person_id" },
      },
      {
        table: "calendar_preferences",
        rows: [
          { user_id: ME, calendar_id: UUID_A, position: 0 },
          { user_id: ME, calendar_id: UUID_C, position: 1 },
          { user_id: ME, calendar_id: UUID_B, position: 0 },
        ],
        options: { onConflict: "user_id,calendar_id" },
      },
    ]);
  });

  it("saves the calendars of the group without owner, whose key is not a person (spec 006 RF-22)", async () => {
    const result = await saveOrder({
      people: [ME],
      calendars: { orphan: [UUID_A] },
    });

    expect(result).toEqual({});
    expect(state.upserts.at(-1)).toEqual({
      table: "calendar_preferences",
      rows: [{ user_id: ME, calendar_id: UUID_A, position: 0 }],
      options: { onConflict: "user_id,calendar_id" },
    });
  });

  it("rejects malformed ids", async () => {
    const result = await saveOrder({ people: ["x"], calendars: {} });

    expect(result.error).toBe("Revisa los datos e inténtalo de nuevo.");
    expect(state.upserts).toEqual([]);
  });
});
