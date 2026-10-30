// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 008, T3: inside the event window the actions answer with a state instead
// of redirecting, so the window can close itself (RF-8, RF-9, RF-11, RF-38).
const EVENT_ID = "5b8f6c2e-3f0a-4d8e-9a51-2a8f1d7c9e10";
const CALENDAR_ID = "0d7e1c6a-8b2f-4c3d-9e4f-5a6b7c8d9e0f";

const h = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  rows: [{ id: "x" }] as { id: string }[],
  writeEvent: vi.fn(),
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/sync/write-event", () => ({ writeEvent: h.writeEvent }));
vi.mock("@/lib/sync/engine", () => ({ writeEngineDeps: () => ({}) }));

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
    from: (table: string) =>
      table === "profiles"
        ? {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { time_zone: "Europe/Madrid" },
                  error: null,
                }),
              }),
            }),
          }
        : {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: h.current, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: EVENT_ID }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: async () => ({ data: h.rows, error: null }),
              }),
            }),
            delete: () => ({
              eq: () => ({
                select: async () => ({ data: h.rows, error: null }),
              }),
            }),
          },
  }),
}));

const { createEvent, updateEvent, deleteEvent } =
  await import("@/app/dashboard/events/actions");

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
  },
};

function form(fields: Record<string, string>) {
  const data = new FormData();
  const all = {
    title: "Cena",
    calendarId: CALENDAR_ID,
    startDate: "2026-10-23",
    startTime: "21:00",
    endDate: "2026-10-23",
    endTime: "22:00",
    ...fields,
  };
  for (const [key, value] of Object.entries(all)) data.append(key, value);
  return data;
}

beforeEach(() => {
  h.revalidatePath.mockClear();
  h.rows = [{ id: EVENT_ID }];
  h.writeEvent.mockReset();
  h.writeEvent.mockResolvedValue({ status: "normal" });
  h.current = {
    calendar_id: CALENDAR_ID,
    title: "Antes",
    description: null,
    location: null,
    starts_at: "2026-10-23T19:00:00.000Z",
    ends_at: "2026-10-23T20:00:00.000Z",
    all_day: false,
  };
});

describe("event actions in the window", () => {
  it("createEvent answers 'created' instead of redirecting", async () => {
    const state = await createEvent(EMPTY, form({ mode: "modal" }));

    expect(state.done).toBe("created");
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("updateEvent answers 'updated' instead of redirecting", async () => {
    const state = await updateEvent(EVENT_ID, EMPTY, form({ mode: "modal" }));

    expect(state.done).toBe("updated");
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("keeps what was typed and the field errors when validation fails (RF-9)", async () => {
    const state = await createEvent(EMPTY, form({ mode: "modal", title: "" }));

    expect(state.done).toBeUndefined();
    expect(state.fieldErrors?.title).toBeTruthy();
    expect(state.values.startTime).toBe("21:00");
  });

  it("deleteEvent answers 'deleted' in the window", async () => {
    const state = await deleteEvent(EVENT_ID, "modal");

    expect(state).toEqual({ done: "deleted" });
  });

  // Spec 012, T11: with images to upload the form needs the new id (RF-7).
  it("createEvent with images=1 answers with the event id, also on the full page", async () => {
    const state = await createEvent(EMPTY, form({ images: "1" }));
    expect(state).toMatchObject({ done: "created", eventId: EVENT_ID });
    const modal = await createEvent(
      EMPTY,
      form({ images: "1", mode: "modal" }),
    );
    expect(modal).toMatchObject({ done: "created", eventId: EVENT_ID });
  });

  it("createEvent with images=1 answers with the id written through Google", async () => {
    h.writeEvent.mockResolvedValue({ status: "done", eventId: "synced-id" });
    const state = await createEvent(EMPTY, form({ images: "1" }));
    expect(state).toMatchObject({ done: "created", eventId: "synced-id" });
  });

  it("createEvent without images still redirects to the detail", async () => {
    await expect(createEvent(EMPTY, form({}))).rejects.toThrow(
      `REDIRECT:/dashboard/events/${EVENT_ID}`,
    );
  });

  it("still redirects outside the window (RF-10)", async () => {
    await expect(createEvent(EMPTY, form({}))).rejects.toThrow(
      `REDIRECT:/dashboard/events/${EVENT_ID}`,
    );
    await expect(deleteEvent(EVENT_ID)).rejects.toThrow(
      "REDIRECT:/dashboard/calendar",
    );
  });
});

// Spec 009, T8: events of synced calendars go through the write engine (plan
// D3, D4; RF-10 to RF-12, RF-18, RF-21 to RF-26).
describe("event actions in synced calendars", () => {
  it("createEvent sends the row to the engine and closes with 'created' (RF-10, RF-18)", async () => {
    h.writeEvent.mockResolvedValue({ status: "done", eventId: EVENT_ID });
    const state = await createEvent(EMPTY, form({ mode: "modal" }));

    expect(state.done).toBe("created");
    expect(h.writeEvent.mock.calls[0][0]).toMatchObject({
      op: "create",
      row: { calendar_id: CALENDAR_ID, title: "Cena" },
    });
  });

  it("updateEvent passes the event before the change (RF-11, RF-14)", async () => {
    h.writeEvent.mockResolvedValue({ status: "done", eventId: EVENT_ID });
    const state = await updateEvent(EVENT_ID, EMPTY, form({ mode: "modal" }));

    expect(state.done).toBe("updated");
    expect(h.writeEvent.mock.calls[0][0]).toMatchObject({
      op: "update",
      eventId: EVENT_ID,
      calendarId: CALENDAR_ID,
      before: { title: "Antes" },
      row: { title: "Cena" },
    });
  });

  it("deleteEvent goes through the engine (RF-12)", async () => {
    h.writeEvent.mockResolvedValue({ status: "done", eventId: EVENT_ID });
    expect(await deleteEvent(EVENT_ID, "modal")).toEqual({ done: "deleted" });
    expect(h.writeEvent.mock.calls[0][0]).toMatchObject({
      op: "delete",
      eventId: EVENT_ID,
      calendarId: CALENDAR_ID,
    });
  });

  it.each([
    ["transient", /Google no responde/],
    ["revoked", /Vuelve a conectarla/],
    ["rejected", /Google no ha permitido/],
  ])(
    "a %s failure keeps what was typed and says why in Spanish (RF-21 to RF-24, RF-26)",
    async (failure, text) => {
      h.writeEvent.mockResolvedValue({ status: "failed", failure });
      const state = await updateEvent(
        EVENT_ID,
        EMPTY,
        form({ mode: "modal", title: "Nuevo" }),
      );

      expect(state.done).toBeUndefined();
      expect(state.formError).toMatch(text);
      expect(state.values.title).toBe("Nuevo");
      expect(h.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("an event deleted in Google closes the window with 'gone' (RF-25)", async () => {
    h.writeEvent.mockResolvedValue({ status: "gone" });
    const state = await updateEvent(EVENT_ID, EMPTY, form({ mode: "modal" }));
    expect(state.done).toBe("gone");
    expect(h.revalidatePath).toHaveBeenCalled();

    const deleted = await deleteEvent(EVENT_ID, "modal");
    expect(deleted).toEqual({ done: "gone" });
  });

  it("an event that is not visible is not found", async () => {
    h.current = null;
    const state = await updateEvent(EVENT_ID, EMPTY, form({ mode: "modal" }));
    expect(state.formError).toBe("Este elemento ya no existe.");
    expect(h.writeEvent).not.toHaveBeenCalled();
  });

  it("a database refusal is explained like any other (RF-20)", async () => {
    h.writeEvent.mockResolvedValue({
      status: "dbError",
      error: { code: "22023" },
    });
    const state = await createEvent(EMPTY, form({ mode: "modal" }));
    expect(state.formError).toBe("Revisa los datos e inténtalo de nuevo.");
  });
});
