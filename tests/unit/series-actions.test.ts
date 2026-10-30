// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 013, T10: creating series from the event form (RF-1, RF-6, RF-7, RF-8,
// RF-29, RF-31).
const EVENT_ID = "5b8f6c2e-3f0a-4d8e-9a51-2a8f1d7c9e10";
const CALENDAR_ID = "0d7e1c6a-8b2f-4c3d-9e4f-5a6b7c8d9e0f";

const h = vi.hoisted(() => ({
  inserted: [] as Record<string, unknown>[],
  insertError: null as { code: string; message: string } | null,
  synced: null as { calendar_id: string } | null,
  writeEvent: vi.fn(),
}));

vi.mock("@/lib/sync/write-event", () => ({ writeEvent: h.writeEvent }));
vi.mock("@/lib/sync/engine", () => ({ writeEngineDeps: () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u1" } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              table === "profiles"
                ? { time_zone: "Europe/Madrid" }
                : table === "synced_calendars"
                  ? h.synced
                  : null,
            error: null,
          }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        h.inserted.push(row);
        return {
          select: () => ({
            single: async () =>
              h.insertError
                ? { data: null, error: h.insertError }
                : { data: { id: EVENT_ID }, error: null },
          }),
        };
      },
    }),
  }),
}));

const { createEvent } = await import("@/app/dashboard/events/actions");

const EMPTY = {
  values: {
    title: "",
    calendarId: "",
    allDay: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    description: "",
    location: "",
    color: "",
    categoryId: "",
    repeat: "none",
  },
};

function form(fields: Record<string, string>) {
  const data = new FormData();
  const all = {
    mode: "modal",
    title: "Extraescolar",
    calendarId: CALENDAR_ID,
    // Wednesday 7 October 2026, 18:00 in Madrid.
    startDate: "2026-10-07",
    startTime: "18:00",
    endDate: "2026-10-07",
    endTime: "19:30",
    ...fields,
  };
  for (const [key, value] of Object.entries(all)) data.append(key, value);
  return data;
}

beforeEach(() => {
  h.inserted = [];
  h.insertError = null;
  h.synced = null;
  h.writeEvent.mockReset();
  h.writeEvent.mockResolvedValue({ status: "normal" });
});

describe("createEvent with Repetir", () => {
  it("'No se repite' creates a single event, as before (RF-1)", async () => {
    const state = await createEvent(EMPTY, form({ repeat: "none" }));
    expect(state.done).toBe("created");
    expect(h.inserted[0]).not.toHaveProperty("recurrence");
  });

  it("a quick option saves the rule, the profile's zone and no end (RF-6, RF-12)", async () => {
    const state = await createEvent(EMPTY, form({ repeat: "weekly" }));
    expect(state.done).toBe("created");
    expect(h.inserted[0]).toMatchObject({
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=WE",
      recurrence_tz: "Europe/Madrid",
      recurrence_until: null,
      starts_at: "2026-10-07T16:00:00.000Z",
      ends_at: "2026-10-07T17:30:00.000Z",
      created_by: "u1",
    });
    expect(h.writeEvent).not.toHaveBeenCalled();
  });

  it("moves the start to the first occurrence of a custom rule (casos límite)", async () => {
    await createEvent(
      EMPTY,
      form({ repeat: "custom:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=2" }),
    );
    expect(h.inserted[0]).toMatchObject({
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=2",
      starts_at: "2026-10-12T16:00:00.000Z",
      ends_at: "2026-10-12T17:30:00.000Z",
      recurrence_until: "2026-10-19T17:30:00.000Z",
    });
  });

  it("all-day series have no zone (RF-6, RF-14)", async () => {
    await createEvent(
      EMPTY,
      form({ allDay: "on", repeat: "yearly", endDate: "2026-10-07" }),
    );
    expect(h.inserted[0]).toMatchObject({
      recurrence: "FREQ=YEARLY;INTERVAL=1;BYMONTH=10;BYMONTHDAY=7",
      recurrence_tz: null,
      all_day: true,
      starts_at: "2026-10-07T00:00:00.000Z",
    });
  });

  it("a rule without occurrences is not saved (RF-8)", async () => {
    const state = await createEvent(
      EMPTY,
      form({
        repeat: "custom:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20261011T235959",
      }),
    );
    expect(state.fieldErrors?.repeat).toBe(
      "Con este final la serie no tiene ninguna repetición.",
    );
    expect(state.values.repeat).toBe(
      "custom:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20261011T235959",
    );
    expect(h.inserted).toEqual([]);
  });

  it("an invalid value is refused next to the field", async () => {
    const state = await createEvent(
      EMPTY,
      form({ repeat: "custom:FREQ=HOURLY" }),
    );
    expect(state.fieldErrors?.repeat).toBe("Elige una repetición válida.");
    expect(h.inserted).toEqual([]);
  });

  it("no series in a calendar of Google (RF-29)", async () => {
    h.synced = { calendar_id: CALENDAR_ID };
    const state = await createEvent(EMPTY, form({ repeat: "daily" }));
    expect(state.fieldErrors?.repeat).toBe(
      "Los calendarios de Google no admiten repeticiones en CaFam.",
    );
    expect(h.writeEvent).not.toHaveBeenCalled();
    expect(h.inserted).toEqual([]);
  });

  it("explains the limit of 500 series (RF-31)", async () => {
    h.insertError = { code: "CF429", message: "series" };
    const state = await createEvent(EMPTY, form({ repeat: "daily" }));
    expect(state.formError).toBe(
      "Este calendario ya tiene 500 series. Borra alguna para crear otra.",
    );
  });
});
