import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRefs } from "@/lib/assistant/citations";
import {
  TOOL_DEFINITIONS,
  runTool,
  type CitedEvent,
  type ToolContext,
} from "@/lib/assistant/tools";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 015, T6: the tools run with the user's session (plan assistant-tools,
// D2, D6, D11, D12; RF-8 to RF-10, RF-12, RF-14 to RF-16, RF-18, RF-20,
// RF-22 to RF-25, RF-29, RF-31).
const TZ = "Europe/Madrid";
const NOW = new Date("2026-11-02T09:00:00Z"); // Monday

let asker: TestUser; // Marta
let luis: TestUser; // consents
let ana: TestUser; // does not consent
let stranger: TestUser;
let askerCal: string;
let hiddenCal: string;
let googleCal: string;
let luisCal: string;
let anaCal: string;
let strangerCal: string;

function context(
  user: TestUser,
  extra: Partial<ToolContext> = {},
): ToolContext {
  return {
    supabase: user.client,
    userId: user.id,
    timeZone: TZ,
    now: NOW,
    refs: createRefs<CitedEvent>(),
    excludeSynced: false,
    ...extra,
  };
}

async function call(name: string, args: object, ctx: ToolContext) {
  return JSON.parse(
    JSON.stringify(await runTool(name, JSON.stringify(args), ctx)),
  );
}

async function createCalendar(ownerId: string, name: string) {
  const { data, error } = await admin
    .from("calendars")
    .insert({ owner_id: ownerId, name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  [asker, luis, ana, stranger] = await Promise.all([
    createTestUser({ display_name: "Marta" }),
    createTestUser({ display_name: "Luis Pérez" }),
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  [askerCal, luisCal, anaCal, strangerCal] = await Promise.all(
    [asker, luis, ana, stranger].map((u) => getOwnCalendarId(u.id)),
  );
  hiddenCal = await createCalendar(asker.id, "Oculto");
  googleCal = await createCalendar(asker.id, "Google");

  const { data: connection, error: connError } = await admin
    .from("calendar_connections")
    .insert({
      owner_id: asker.id,
      provider: "google",
      account_subject: `sub-${randomUUID()}`,
      account_email: "marta@gmail.test",
    })
    .select("id")
    .single();
  if (connError) throw connError;
  await admin.from("synced_calendars").insert({
    calendar_id: googleCal,
    connection_id: connection.id,
    provider: "google",
    external_id: `cal-${randomUUID()}`,
  });
  // Hidden in the filters, still used (RF-10).
  await admin
    .from("calendar_preferences")
    .insert({ user_id: asker.id, calendar_id: hiddenCal, visible: false });

  // Luis and Ana are members of Marta's family calendar; Luis consents.
  await admin.from("calendar_members").insert([
    { calendar_id: askerCal, user_id: luis.id, role: "editor" },
    { calendar_id: askerCal, user_id: ana.id, role: "viewer" },
  ]);
  await admin
    .from("profiles")
    .update({ share_availability: true })
    .in("id", [luis.id, stranger.id]);
  await admin.from("calendars").update({ name: "Familia" }).eq("id", askerCal);

  const at = (day: string, from: string, to: string) => ({
    starts_at: `${day}T${from}:00+01:00`,
    ends_at: `${day}T${to}:00+01:00`,
  });
  const { error } = await admin.from("events").insert(
    [
      {
        calendar_id: askerCal,
        title: "Fútbol de Pablo",
        location: "Polideportivo",
        ...at("2026-11-07", "10:00", "11:30"),
      },
      {
        calendar_id: askerCal,
        title: "Comida con los abuelos",
        ...at("2026-11-08", "14:00", "16:00"),
      },
      {
        calendar_id: hiddenCal,
        title: "Dentista",
        description: "Revisión anual",
        ...at("2026-11-07", "17:00", "18:00"),
      },
      {
        calendar_id: googleCal,
        title: "Reunión de Google",
        external_id: `ev-${randomUUID()}`,
        ...at("2026-11-07", "12:00", "13:00"),
      },
      {
        calendar_id: askerCal,
        title: "Cumpleaños de Ana",
        all_day: true,
        starts_at: "2026-12-14T00:00:00Z",
        ends_at: "2026-12-15T00:00:00Z",
      },
      {
        calendar_id: askerCal,
        title: "Clase de inglés",
        starts_at: "2026-11-03T18:00:00+01:00",
        ends_at: "2026-11-03T19:00:00+01:00",
        recurrence: "FREQ=WEEKLY;BYDAY=TU",
        recurrence_tz: TZ,
      },
      {
        calendar_id: askerCal,
        title: "100% pasta_fresca",
        ...at("2026-11-20", "20:00", "21:00"),
      },
      // Free time next week (9-15): Marta busy Mon 16-18; Luis privately Mon 19-21.
      {
        calendar_id: askerCal,
        title: "Reunión del cole",
        ...at("2026-11-09", "16:00", "18:00"),
      },
      {
        calendar_id: luisCal,
        title: "Médico secreto",
        location: "Clínica",
        ...at("2026-11-09", "19:00", "21:00"),
      },
      // Ana's private event is invisible to Marta and Ana has not consented.
      {
        calendar_id: anaCal,
        title: "Privado de Ana",
        ...at("2026-11-10", "16:00", "21:00"),
      },
      {
        calendar_id: strangerCal,
        title: "De Sam",
        ...at("2026-11-09", "16:00", "21:00"),
      },
    ],
    { defaultToNull: false },
  );
  if (error) throw error;

  // 60 events in one day, for "muchos eventos".
  await admin.from("events").insert(
    Array.from({ length: 60 }, (_, i) => ({
      calendar_id: hiddenCal,
      title: `Turno ${i + 1}`,
      starts_at: `2026-11-25T${String(8 + Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}:00+01:00`,
      ends_at: `2026-11-25T${String(8 + Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10 + 5).padStart(2, "0")}:00+01:00`,
    })),
  );
});

afterAll(async () => {
  await Promise.all(
    [asker, luis, ana, stranger].map((user) => deleteTestUser(user.id)),
  );
  await deleteTestMail();
});

describe("tool definitions (RF-25)", () => {
  it("only read", () => {
    expect(TOOL_DEFINITIONS.map((tool) => tool.function.name)).toEqual([
      "list_events",
      "search_events",
      "find_free_time",
    ]);
  });
});

describe("list_events (RF-8, RF-10, RF-12)", () => {
  it("lists the period with calendar and place, hidden calendars and occurrences included", async () => {
    const ctx = context(asker);
    const result = await call(
      "list_events",
      { from: "2026-11-07", to: "2026-11-10" },
      ctx,
    );
    expect(result.total).toBe(6); // includes the English class of Tuesday 10
    expect(result.truncated).toBe(false);
    expect(result.events).toContainEqual({
      ref: expect.stringMatching(/^e\d+$/),
      date: "2026-11-07",
      weekday: "sábado",
      start: "10:00",
      end: "11:30",
      title: "Fútbol de Pablo",
      calendar: "Familia",
      location: "Polideportivo",
    });
    const titles = result.events.map((e: { title: string }) => e.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Dentista",
        "Reunión de Google",
        "Comida con los abuelos",
        "Reunión del cole",
      ]),
    );
    // The cited events keep their id for the answer (RF-11).
    const ref = result.events.find(
      (e: { title: string }) => e.title === "Dentista",
    ).ref;
    expect(ctx.refs.get(ref)).toMatchObject({
      title: "Dentista",
      calendarName: "Oculto",
    });
  });

  it("counts each occurrence of a series", async () => {
    const result = await call(
      "list_events",
      { from: "2026-11-02", to: "2026-11-24" },
      context(asker),
    );
    expect(
      result.events
        .filter((e: { title: string }) => e.title === "Clase de inglés")
        .map((e: { date: string }) => e.date),
    ).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  });

  it("returns an empty list, or the first 30 of many", async () => {
    expect(
      await call(
        "list_events",
        { from: "2026-11-11", to: "2026-11-11" },
        context(asker),
      ),
    ).toEqual({
      total: 0,
      truncated: false,
      events: [],
    });
    const many = await call(
      "list_events",
      { from: "2026-11-25", to: "2026-11-25" },
      context(asker),
    );
    expect(many.total).toBe(60);
    expect(many.truncated).toBe(true);
    expect(many.events).toHaveLength(30);
  });

  it("never lists a calendar the user does not see", async () => {
    const result = await call(
      "list_events",
      { from: "2026-11-09", to: "2026-11-10" },
      context(asker),
    );
    const text = JSON.stringify(result);
    expect(text).not.toContain("Médico secreto");
    expect(text).not.toContain("Privado de Ana");
    expect(text).not.toContain("De Sam");
  });

  it("explains bad dates", async () => {
    expect(
      await call(
        "list_events",
        { from: "2026-02-31", to: "2026-03-01" },
        context(asker),
      ),
    ).toEqual({
      status: "invalid_date",
    });
    expect(
      await call(
        "list_events",
        { from: "2026-01-01", to: "2026-12-31" },
        context(asker),
      ),
    ).toEqual({
      status: "too_long",
    });
    expect(await call("list_events", { from: 3 }, context(asker))).toEqual({
      status: "invalid_arguments",
    });
  });

  it("leaves Google calendars out if the provider trained on the data (RF-31)", async () => {
    const result = await call(
      "list_events",
      { from: "2026-11-07", to: "2026-11-07" },
      context(asker, { excludeSynced: true }),
    );
    expect(JSON.stringify(result)).not.toContain("Reunión de Google");
    expect(JSON.stringify(result)).toContain("Fútbol de Pablo");
  });
});

describe("search_events (RF-9)", () => {
  it("finds by title, place or description, with dates", async () => {
    const birthday = await call(
      "search_events",
      { query: "cumpleaños" },
      context(asker),
    );
    expect(birthday.events).toEqual([
      expect.objectContaining({
        title: "Cumpleaños de Ana",
        date: "2026-12-14",
        allDay: true,
      }),
    ]);
    const place = await call(
      "search_events",
      { query: "polideportivo" },
      context(asker),
    );
    expect(place.events.map((e: { title: string }) => e.title)).toEqual([
      "Fútbol de Pablo",
    ]);
    const description = await call(
      "search_events",
      { query: "revisión" },
      context(asker),
    );
    expect(description.events.map((e: { title: string }) => e.title)).toEqual([
      "Dentista",
    ]);
  });

  it("gives the next occurrences of a series, at most 20", async () => {
    const result = await call(
      "search_events",
      { query: "inglés" },
      context(asker),
    );
    expect(result.events.length).toBe(20);
    expect(result.events[0]).toMatchObject({ title: "Clase de inglés" });
    expect(result.total).toBeGreaterThan(20);
  });

  it("treats % and _ as plain characters", async () => {
    const result = await call(
      "search_events",
      { query: "100%" },
      context(asker),
    );
    expect(result.events.map((e: { title: string }) => e.title)).toEqual([
      "100% pasta_fresca",
    ]);
    const none = await call("search_events", { query: "a_a" }, context(asker));
    expect(none.events).toEqual([]);
  });

  it("does not find what the user cannot see", async () => {
    const result = await call(
      "search_events",
      { query: "secreto" },
      context(asker),
    );
    expect(result.events).toEqual([]);
  });
});

describe("find_free_time (RF-14 to RF-16, RF-18, RF-20, RF-22 to RF-24)", () => {
  it("uses the consented times of Luis as busy, without their details", async () => {
    const result = await call(
      "find_free_time",
      {
        people: ["Luis"],
        from: "2026-11-09",
        to: "2026-11-09",
        ranges: [{ start: "16:00", end: "21:00" }],
      },
      context(asker),
    );
    expect(result).toEqual({
      status: "ok",
      people: ["Luis Pérez"],
      withoutConsent: [],
      days: [
        {
          date: "2026-11-09",
          weekday: "lunes",
          free: [{ start: "18:00", end: "19:00" }],
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/Médico|Clínica/);
  });

  it("uses only what the asker sees of Ana and says so (RF-22)", async () => {
    const result = await call(
      "find_free_time",
      {
        people: ["ana"],
        from: "2026-11-10",
        to: "2026-11-10",
        ranges: [{ start: "16:00", end: "21:00" }],
      },
      context(asker),
    );
    // Ana's private event is not counted; the weekly English class is (shared calendar).
    expect(result).toMatchObject({
      status: "ok",
      people: ["Ana"],
      withoutConsent: ["Ana"],
      // T12: the model sometimes left this out when it had to word it itself.
      notice:
        "Ana no ha dado permiso para consultar su disponibilidad: solo se han tenido en cuenta sus eventos que ves.",
      days: [
        {
          date: "2026-11-10",
          free: [
            { start: "16:00", end: "18:00" },
            { start: "19:00", end: "21:00" },
          ],
        },
      ],
    });
  });

  it("uses the default ranges and lets the all-day events fill the day (RF-17, RF-18)", async () => {
    const result = await call(
      "find_free_time",
      { people: [], from: "2026-12-14", to: "2026-12-14" },
      context(asker),
    );
    expect(result.days).toEqual([
      { date: "2026-12-14", weekday: "lunes", free: [] },
    ]);
    const free = await call(
      "find_free_time",
      { people: [], from: "2026-12-13", to: "2026-12-13" },
      context(asker),
    );
    expect(free.days[0].free).toHaveLength(3);
  });

  it("does not recognise unknown or unrelated people (RF-15, RF-16)", async () => {
    expect(
      await call(
        "find_free_time",
        { people: ["Sam"], from: "2026-11-09", to: "2026-11-09" },
        context(asker),
      ),
    ).toEqual({ status: "not_found", name: "Sam" });
    expect(
      await call(
        "find_free_time",
        { people: ["Pedro"], from: "2026-11-09", to: "2026-11-09" },
        context(asker),
      ),
    ).toEqual({ status: "not_found", name: "Pedro" });
  });

  it("asks for a shorter period over 31 days (RF-24)", async () => {
    expect(
      await call(
        "find_free_time",
        { people: ["Luis"], from: "2026-11-01", to: "2026-12-15" },
        context(asker),
      ),
    ).toEqual({ status: "too_long" });
  });
});
