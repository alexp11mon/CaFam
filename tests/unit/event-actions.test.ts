// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 008, T3: inside the event window the actions answer with a state instead
// of redirecting, so the window can close itself (RF-8, RF-9, RF-11, RF-38).
const EVENT_ID = "5b8f6c2e-3f0a-4d8e-9a51-2a8f1d7c9e10";
const CALENDAR_ID = "0d7e1c6a-8b2f-4c3d-9e4f-5a6b7c8d9e0f";

const h = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  rows: [{ id: "x" }] as { id: string }[],
}));

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

  it("still redirects outside the window (RF-10)", async () => {
    await expect(createEvent(EMPTY, form({}))).rejects.toThrow(
      `REDIRECT:/dashboard/events/${EVENT_ID}`,
    );
    await expect(deleteEvent(EVENT_ID)).rejects.toThrow(
      "REDIRECT:/dashboard/calendar",
    );
  });
});
