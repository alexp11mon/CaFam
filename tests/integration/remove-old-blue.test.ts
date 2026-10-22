import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 005, T13: the old blue #2563EB is gone from the database. Calendars
// created without a color get sky blue, and nothing keeps the old value
// (RF-56, RF-57; plan D19).
const SKY = "#A0C4FF";
let user: TestUser;

beforeAll(async () => {
  user = await createTestUser({ display_name: "Sin azul" });
});

afterAll(async () => {
  if (user) await deleteTestUser(user.id);
});

async function colorOf(calendarId: string): Promise<string | undefined> {
  const { data } = await admin
    .from("calendars")
    .select("color")
    .eq("id", calendarId)
    .single();
  return data?.color;
}

describe("calendars without a chosen color (RF-56)", () => {
  it("a new user's first calendar is sky blue", async () => {
    expect(await colorOf(await getOwnCalendarId(user.id))).toBe(SKY);
  });

  it("an imported calendar without a color is sky blue", async () => {
    const { data: id, error } = await user.client.rpc("import_calendar", {
      p_name: "Importado",
      p_color: null as unknown as string,
      p_events: [
        {
          title: "Evento",
          starts_at: "2026-11-02T09:00:00Z",
          ends_at: "2026-11-02T10:00:00Z",
        },
      ],
    });

    expect(error).toBeNull();
    expect(await colorOf(id!)).toBe(SKY);
  });

  it("merging into a new calendar without a color gives sky blue", async () => {
    const [first, second] = await Promise.all(
      ["Uno", "Dos"].map(async (name) => {
        const { data, error } = await user.client
          .from("calendars")
          .insert({ owner_id: user.id, name, color: "#FFADAD" })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }),
    );

    const { data: id, error } = await user.client.rpc("merge_calendars", {
      p_source_ids: [first!, second!],
      p_name: "Juntos",
    });

    expect(error).toBeNull();
    expect(await colorOf(id!)).toBe(SKY);
  });

  it("the column default is sky blue too", async () => {
    const { data, error } = await user.client
      .from("calendars")
      .insert({ owner_id: user.id, name: "Sin color" })
      .select("color")
      .single();

    expect(error).toBeNull();
    expect(data?.color).toBe(SKY);
  });
});

describe("stored colors (RF-57)", () => {
  it("no calendar or event keeps the old blue", async () => {
    const [calendars, events] = await Promise.all([
      admin
        .from("calendars")
        .select("id", { count: "exact", head: true })
        .ilike("color", "#2563eb"),
      admin
        .from("events")
        .select("id", { count: "exact", head: true })
        .ilike("color", "#2563eb"),
    ]);

    expect(calendars.error).toBeNull();
    expect(events.error).toBeNull();
    expect(calendars.count).toBe(0);
    expect(events.count).toBe(0);
  });
});
