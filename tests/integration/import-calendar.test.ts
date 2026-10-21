import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// import_calendar (plan "Funciones SQL", D5): RF-7, RF-11, RF-12, RF-27, RF-30.
let user: TestUser;

const EVENT = {
  title: "Clase de álgebra",
  description: "Aula 3",
  location: "Facultad",
  starts_at: "2026-11-02T09:00:00Z",
  ends_at: "2026-11-02T10:00:00Z",
  all_day: false,
};

beforeAll(async () => {
  user = await createTestUser({ display_name: "Importadora" });
});

afterAll(async () => {
  if (user) await deleteTestUser(user.id);
});

async function importCalendar(
  events: unknown,
  name = "Importado",
  color: string | null = "#CAFFBF",
) {
  return user.client.rpc("import_calendar", {
    p_name: name,
    p_color: color as string,
    p_events: events as never,
  });
}

async function calendarsNamed(name: string) {
  const { data, error } = await admin
    .from("calendars")
    .select("*")
    .eq("owner_id", user.id)
    .eq("name", name);
  if (error) throw error;
  return data;
}

describe("import_calendar (RF-7)", () => {
  it("creates an owned calendar with its events", async () => {
    const { data: id, error } = await importCalendar([
      EVENT,
      {
        title: "Cumpleaños",
        description: null,
        location: null,
        starts_at: "2026-12-01T00:00:00Z",
        ends_at: "2026-12-02T00:00:00Z",
        all_day: true,
      },
    ]);
    expect(error).toBeNull();

    const { data: calendar } = await admin
      .from("calendars")
      .select("owner_id, name, color")
      .eq("id", id!)
      .single();
    expect(calendar).toEqual({
      owner_id: user.id,
      name: "Importado",
      color: "#CAFFBF",
    });

    const { data: member } = await admin
      .from("calendar_members")
      .select("role")
      .eq("calendar_id", id!)
      .eq("user_id", user.id)
      .single();
    expect(member?.role).toBe("owner");

    const { data: events } = await admin
      .from("events")
      .select("title, description, location, all_day, created_by, starts_at")
      .eq("calendar_id", id!)
      .order("starts_at");
    expect(events).toHaveLength(2);
    expect(events?.[0]).toMatchObject({
      title: "Clase de álgebra",
      description: "Aula 3",
      location: "Facultad",
      all_day: false,
      created_by: user.id,
    });
    expect(events?.[1]).toMatchObject({ title: "Cumpleaños", all_day: true });
  });

  it("uses the brand blue when there is no color", async () => {
    const { data: id } = await importCalendar([EVENT], "Sin color", null);

    const { data } = await admin
      .from("calendars")
      .select("color")
      .eq("id", id!)
      .single();
    expect(data?.color).toBe("#2563EB");
  });
});

describe("import_calendar keeps no trace of the source (RF-11, RF-12)", () => {
  it("creates a plain calendar with the usual columns only", async () => {
    await importCalendar([EVENT], "Columnas");

    const [calendar] = await calendarsNamed("Columnas");
    expect(Object.keys(calendar).sort()).toEqual(
      [
        "color",
        "created_at",
        "description",
        "id",
        "name",
        "owner_id",
        "updated_at",
      ].sort(),
    );
  });

  it("two identical imports give two independent calendars", async () => {
    const first = await importCalendar([EVENT], "Doble");
    const second = await importCalendar([EVENT], "Doble");

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data).not.toBe(second.data);
    expect(await calendarsNamed("Doble")).toHaveLength(2);
  });
});

describe("import_calendar limits (RF-27)", () => {
  it("rejects what is not an array of 1 to 2000 events with 22023", async () => {
    const tooMany = Array.from({ length: 2001 }, () => EVENT);
    for (const events of [{}, "x", [], tooMany, null]) {
      const { error } = await importCalendar(events, "Límites");
      expect(error?.code).toBe("22023");
    }
    expect(await calendarsNamed("Límites")).toHaveLength(0);
  });

  it("accepts exactly 2000 events", async () => {
    const events = Array.from({ length: 2000 }, (_, i) => ({
      ...EVENT,
      title: `Evento ${i}`,
    }));

    const { data: id, error } = await importCalendar(events, "Dos mil");

    expect(error).toBeNull();
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", id!);
    expect(count).toBe(2000);
  });
});

describe("import_calendar is atomic (RF-30)", () => {
  it("leaves neither the calendar nor any event when one event fails", async () => {
    const { error } = await importCalendar(
      [
        EVENT,
        { ...EVENT, ends_at: "2026-11-02T08:00:00Z" }, // ends before it starts
      ],
      "Atómico",
    );

    expect(error).not.toBeNull();
    expect(await calendarsNamed("Atómico")).toHaveLength(0);
  });

  it("rejects an empty title without leaving a calendar behind", async () => {
    const { error } = await importCalendar(
      [{ ...EVENT, title: "  " }],
      "Vacío",
    );

    expect(error?.code).toBe("23514");
    expect(await calendarsNamed("Vacío")).toHaveLength(0);
  });
});

describe("import_calendar access", () => {
  it("anon cannot call it", async () => {
    const { error } = await anonClient().rpc("import_calendar", {
      p_name: "Anon",
      p_color: "#2563EB",
      p_events: [EVENT] as never,
    });

    expect(error?.code).toBe("42501");
  });
});
