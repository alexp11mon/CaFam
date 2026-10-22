import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runImport } from "@/lib/ics/import-calendar";
import { MAX_BYTES } from "@/lib/ics/limits";
import {
  admin,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// The whole import against `dev` with sample files in the style of Google,
// iCloud and Outlook (spec 004, T10): RF-12, RF-13, RF-16, RF-27 and the
// performance requirement. Nobody's real calendar is used.
const TODAY = { year: 2026, month: 10, day: 22 };
const PROFILE_ZONE = "Europe/Madrid";

let user: TestUser;
let editor: TestUser;

function fixture(name: string): string {
  return readFileSync(`tests/fixtures/ics/${name}`, "utf8");
}

async function importText(text: string, name: string | null = null) {
  const result = await runImport({
    source: { kind: "text", text },
    profileTimeZone: PROFILE_ZONE,
    today: TODAY,
    name,
  });
  if (!result.ok) throw new Error(`import failed: ${result.error.kind}`);
  const { data, error } = await user.client.rpc("import_calendar", {
    p_name: result.name,
    p_color: "#CAFFBF",
    p_events: result.events as never,
  });
  if (error) throw error;
  return { id: data, result };
}

async function eventsOf(calendarId: string) {
  const { data, error } = await admin
    .from("events")
    .select("title, description, location, starts_at, ends_at, all_day")
    .eq("calendar_id", calendarId)
    .order("starts_at");
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  [user, editor] = await Promise.all([
    createTestUser({ display_name: "Importadora", time_zone: PROFILE_ZONE }),
    createTestUser({ display_name: "Editora" }),
  ]);
});

afterAll(async () => {
  await Promise.all(
    [user, editor].filter(Boolean).map((u) => deleteTestUser(u.id)),
  );
});

describe("Google style file (RF-13, RF-16, RF-22..RF-25)", () => {
  it("stores the series with its exclusion and its modified repetition", async () => {
    const { id, result } = await importText(fixture("google.ics"));

    expect(result).toMatchObject({
      name: "Calendario Google",
      skipped: 0,
      cutSeries: 0,
    });
    const events = await eventsOf(id);
    expect(events).toHaveLength(7);

    const series = events.filter((e) => e.title.startsWith("Álgebra"));
    // 6 repetitions, one excluded (16 Nov) and one moved (23 Nov -> 24 Nov 15:30).
    expect(series.map((e) => [e.title, e.starts_at])).toEqual([
      ["Álgebra", "2026-11-02T09:00:00+00:00"],
      ["Álgebra", "2026-11-09T09:00:00+00:00"],
      ["Álgebra (cambio de aula)", "2026-11-24T14:30:00+00:00"],
      ["Álgebra", "2026-11-30T09:00:00+00:00"],
      ["Álgebra", "2026-12-07T09:00:00+00:00"],
    ]);
    expect(series[0]).toMatchObject({
      description: "Aula 3, planta 2\nTraer calculadora",
      location: "Facultad de Matemáticas",
      ends_at: "2026-11-02T10:30:00+00:00",
      all_day: false,
    });
    expect(series[2].location).toBe("Aula 7");
  });

  it("stores UTC events and multi-day events as they are", async () => {
    const { id } = await importText(fixture("google.ics"));

    const events = await eventsOf(id);
    const meeting = events.find((e) => e.title === "Reunión de proyecto");
    const holidays = events.find((e) => e.title === "Vacaciones de Navidad");
    expect(meeting).toMatchObject({
      starts_at: "2026-11-10T18:00:00+00:00",
      ends_at: "2026-11-10T19:00:00+00:00",
    });
    expect(holidays).toMatchObject({
      all_day: true,
      starts_at: "2026-12-24T00:00:00+00:00",
      ends_at: "2026-12-27T00:00:00+00:00",
    });
  });
});

describe("iCloud style file (RF-17, RF-23)", () => {
  it("creates the yearly birthday up to one year ahead and cuts the series", async () => {
    const { id, result } = await importText(fixture("icloud.ics"));

    expect(result).toMatchObject({
      name: "iCloud Familia",
      skipped: 0,
      cutSeries: 1,
    });
    const events = await eventsOf(id);
    const birthdays = events.filter((e) => e.title === "Cumpleaños de Lucía");
    // 1990 to 2027 inclusive: 2028-03-15 is beyond the one-year horizon.
    expect(birthdays).toHaveLength(38);
    expect(birthdays[0]).toMatchObject({
      all_day: true,
      starts_at: "1990-03-15T00:00:00+00:00",
      ends_at: "1990-03-16T00:00:00+00:00",
    });
    expect(birthdays.at(-1)?.starts_at).toBe("2027-03-15T00:00:00+00:00");
  });

  it("gives an all-day event without end one day and converts a New York flight", async () => {
    const { id } = await importText(fixture("icloud.ics"));

    const events = await eventsOf(id);
    expect(events.find((e) => e.title === "Boda de Marta")).toMatchObject({
      all_day: true,
      starts_at: "2027-06-05T00:00:00+00:00",
      ends_at: "2027-06-06T00:00:00+00:00",
    });
    expect(events.find((e) => e.title === "Vuelo a Nueva York")).toMatchObject({
      starts_at: "2026-11-20T14:30:00+00:00",
      ends_at: "2026-11-20T17:30:00+00:00",
      location: "Aeropuerto JFK",
    });
  });
});

describe("Outlook style file (RF-20, RF-21)", () => {
  it("leaves out Windows time zones and cancelled events", async () => {
    const { id, result } = await importText(fixture("outlook.ics"));

    // 2 repetitions + 1 event in "Romance Standard Time" are skipped; the
    // cancelled one is not an import failure.
    expect(result).toMatchObject({
      name: "Calendario Outlook",
      skipped: 3,
      cutSeries: 0,
    });
    const events = await eventsOf(id);
    expect(events.map((e) => e.title)).toEqual([
      "Llamada con proveedor",
      "Día de teletrabajo",
    ]);
  });
});

describe("the imported calendar is a normal one (RF-11, RF-12)", () => {
  it("lets the owner edit and delete its events, and an Editor add one", async () => {
    const { id } = await importText(fixture("google.ics"));
    const { data: events } = await user.client
      .from("events")
      .select("id, title")
      .eq("calendar_id", id)
      .order("starts_at");
    const [first, second] = events ?? [];

    const renamed = await user.client
      .from("events")
      .update({ title: "Álgebra editada" })
      .eq("id", first.id)
      .select("title");
    expect(renamed.data).toEqual([{ title: "Álgebra editada" }]);

    const removed = await user.client
      .from("events")
      .delete()
      .eq("id", second.id)
      .select("id");
    expect(removed.data).toHaveLength(1);

    const { error: memberError } = await admin
      .from("calendar_members")
      .insert({ calendar_id: id, user_id: editor.id, role: "editor" });
    if (memberError) throw memberError;
    const added = await editor.client
      .from("events")
      .insert({
        calendar_id: id,
        title: "Añadido por la editora",
        starts_at: "2026-11-05T10:00:00Z",
        ends_at: "2026-11-05T11:00:00Z",
      })
      .select("id");
    expect(added.error).toBeNull();
    expect(await eventsOf(id)).toHaveLength(7);
  });

  it("gives two independent calendars when the same file is imported twice", async () => {
    const first = await importText(fixture("outlook.ics"), "Doble");
    const second = await importText(fixture("outlook.ics"), "Doble");

    expect(first.id).not.toBe(second.id);
    expect(await eventsOf(first.id)).toHaveLength(2);
    expect(await eventsOf(second.id)).toHaveLength(2);
  });
});

describe("limits and performance (RF-27)", () => {
  function manyEvents(count: number, descriptionLength: number): string {
    const description = "d".repeat(descriptionLength);
    const events = Array.from(
      { length: count },
      (_, i) =>
        `BEGIN:VEVENT\r\nUID:e${i}\r\nDTSTART:20261102T100000Z\r\nDTEND:20261102T110000Z\r\nSUMMARY:Evento ${i}\r\nDESCRIPTION:${description}\r\nLOCATION:Lugar ${i}\r\nEND:VEVENT`,
    );
    return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join("\r\n")}\r\nEND:VCALENDAR`;
  }

  it("saves 2000 events from a file close to 2 MB in under 30 seconds", async () => {
    const text = manyEvents(2000, 700);
    expect(Buffer.byteLength(text)).toBeLessThan(MAX_BYTES);
    expect(Buffer.byteLength(text)).toBeGreaterThan(1.5 * 1024 * 1024);

    const started = Date.now();
    const { id, result } = await importText(text, "Dos mil");
    const elapsed = Date.now() - started;
    console.info(
      `TIMING 2000 events, ${Buffer.byteLength(text)} bytes: ${elapsed} ms`,
    );

    expect(result.events).toHaveLength(2000);
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", id);
    expect(count).toBe(2000);
    expect(elapsed).toBeLessThan(30_000);
  }, 60_000);

  it("saves 2000 events with every text at its maximum size", async () => {
    const events = Array.from({ length: 2000 }, (_, i) => ({
      title: `${i}`.padEnd(100, "t"),
      description: "d".repeat(2000),
      location: "l".repeat(200),
      starts_at: "2026-11-02T10:00:00Z",
      ends_at: "2026-11-02T11:00:00Z",
      all_day: false,
    }));

    const started = Date.now();
    const { data: id, error } = await user.client.rpc("import_calendar", {
      p_name: "Máximo",
      p_color: "#A0C4FF",
      p_events: events as never,
    });
    console.info(`TIMING 2000 maximum-size rows: ${Date.now() - started} ms`);

    expect(error).toBeNull();
    // eventsOf would stop at the 1000 rows PostgREST returns by default.
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", id!);
    expect(count).toBe(2000);
  }, 60_000);

  it("rejects 2001 events and creates nothing", async () => {
    const result = await runImport({
      source: { kind: "text", text: manyEvents(2001, 10) },
      profileTimeZone: PROFILE_ZONE,
      today: TODAY,
      name: "Demasiados",
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: "too-many", count: 2001, capped: false },
    });
    const { data } = await admin
      .from("calendars")
      .select("id")
      .eq("owner_id", user.id)
      .eq("name", "Demasiados");
    expect(data).toEqual([]);
  });
});
