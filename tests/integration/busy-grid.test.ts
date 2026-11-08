import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  TEST_PASSWORD,
  uniqueEmail,
  type TestUser,
} from "./helpers";

// Spec 020, T2: busy_grid (plan "Modelo de datos", D1, D2, D4, D5, D13; RF-1,
// RF-2, RF-4, RF-5, RF-7, RF-10, RF-17, RF-18).
let marta: TestUser; // looks
let ana: TestUser; // consents and shares Marta's calendar
let luis: TestUser; // shares, no consent
let sam: TestUser; // consents, shares nothing
let martaCal: string;
let anaCal: string;
let luisCal: string;
let samCal: string;
let seriesId: string;
const extras: string[] = [];

const FROM = "2026-11-09T00:00:00Z";
const TO = "2026-11-16T00:00:00Z";
const COLUMNS = [
  "person_id",
  "starts_at",
  "ends_at",
  "all_day",
  "recurrence",
  "recurrence_tz",
  "exdates",
].sort();

async function consent(id: string, on = true) {
  const { error } = await admin
    .from("profiles")
    .update({ share_busy: on })
    .eq("id", id);
  if (error) throw error;
}

async function show(personId: string, on = true) {
  const { error } = await marta.client
    .from("person_preferences")
    .upsert(
      { user_id: marta.id, person_id: personId, show_busy: on },
      { onConflict: "user_id,person_id" },
    );
  if (error) throw error;
}

async function busy(client = marta.client, from = FROM, to = TO) {
  return client.rpc("grid_busy", { p_from: from, p_to: to });
}

beforeAll(async () => {
  [marta, ana, luis, sam] = await Promise.all([
    createTestUser({ display_name: "Marta" }),
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  [martaCal, anaCal, luisCal, samCal] = await Promise.all(
    [marta, ana, luis, sam].map((u) => getOwnCalendarId(u.id)),
  );
  const { error } = await admin.from("calendar_members").insert([
    { calendar_id: martaCal, user_id: ana.id, role: "editor" },
    { calendar_id: martaCal, user_id: luis.id, role: "editor" },
  ]);
  if (error) throw error;
  await consent(ana.id);
  await consent(sam.id);

  const { data: series, error: seriesError } = await admin
    .from("events")
    .insert({
      calendar_id: anaCal,
      title: "Inglés",
      starts_at: "2026-11-02T17:00:00Z",
      ends_at: "2026-11-02T18:00:00Z",
      recurrence: "FREQ=WEEKLY",
      recurrence_tz: "Europe/Madrid",
      created_by: ana.id,
    })
    .select("id")
    .single();
  if (seriesError) throw seriesError;
  seriesId = series.id;

  const { error: eventsError } = await admin.from("events").insert([
    {
      calendar_id: anaCal,
      title: "Médico",
      location: "Clínica",
      description: "Secreto",
      starts_at: "2026-11-10T08:00:00Z",
      ends_at: "2026-11-10T09:00:00Z",
      created_by: ana.id,
    },
    // The 2026-11-09 repetition moved to Tuesday.
    {
      calendar_id: anaCal,
      title: "Inglés",
      starts_at: "2026-11-11T17:00:00Z",
      ends_at: "2026-11-11T18:00:00Z",
      series_id: seriesId,
      original_start: "2026-11-09T17:00:00Z",
      created_by: ana.id,
    },
    // D13: Ana created it in Marta's calendar → counts.
    {
      calendar_id: martaCal,
      title: "Lo puso Ana",
      starts_at: "2026-11-12T10:00:00Z",
      ends_at: "2026-11-12T11:00:00Z",
      created_by: ana.id,
    },
    // D13: Marta created it in her own shared calendar → not Ana's.
    {
      calendar_id: martaCal,
      title: "Lo puso Marta",
      starts_at: "2026-11-13T10:00:00Z",
      ends_at: "2026-11-13T11:00:00Z",
      created_by: marta.id,
    },
    {
      calendar_id: luisCal,
      title: "Privado de Luis",
      starts_at: "2026-11-10T08:00:00Z",
      ends_at: "2026-11-10T09:00:00Z",
      created_by: luis.id,
    },
    {
      calendar_id: samCal,
      title: "Privado de Sam",
      starts_at: "2026-11-10T08:00:00Z",
      ends_at: "2026-11-10T09:00:00Z",
      created_by: sam.id,
    },
  ]);
  if (eventsError) throw eventsError;
});

afterAll(async () => {
  await Promise.all(
    [marta, ana, luis, sam].map((user) => deleteTestUser(user.id)),
  );
  for (const id of extras) await deleteTestUser(id);
  await deleteTestMail();
});

describe("profiles.share_busy and person_preferences.show_busy (RF-1, RF-2, RF-7)", () => {
  it("are off by default and apart from the assistant's consent", async () => {
    const { data } = await luis.client
      .from("profiles")
      .select("share_busy, share_availability")
      .eq("id", luis.id)
      .single();
    expect(data).toEqual({ share_busy: false, share_availability: false });

    await luis.client
      .from("profiles")
      .update({ share_busy: true })
      .eq("id", luis.id);
    const { data: after } = await luis.client
      .from("profiles")
      .select("share_busy, share_availability")
      .eq("id", luis.id)
      .single();
    expect(after).toEqual({ share_busy: true, share_availability: false });
    await consent(luis.id, false);
  });

  it("only the owner changes them", async () => {
    const { data } = await marta.client
      .from("profiles")
      .update({ share_busy: true })
      .eq("id", luis.id)
      .select("id");
    expect(data).toEqual([]);
  });

  it("a partial upsert keeps the position", async () => {
    await marta.client
      .from("person_preferences")
      .upsert({ user_id: marta.id, person_id: ana.id, position: 3 });
    await show(ana.id);
    const { data } = await marta.client
      .from("person_preferences")
      .select("position, show_busy")
      .eq("person_id", ana.id)
      .single();
    expect(data).toEqual({ position: 3, show_busy: true });
  });
});

describe("busy_people (RF-5, RF-17)", () => {
  it("lists only people who consent and share a calendar", async () => {
    const { data, error } = await marta.client.rpc("busy_people");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: ana.id, display_name: "Ana", shown: true }]);
  });

  it("nobody else reaches it without a session", async () => {
    const { data } = await sam.client.rpc("busy_people");
    expect(data).toEqual([]);
  });
});

describe("grid_busy (RF-10, RF-18, D2, D13)", () => {
  it("returns times only, with D13's events and the exceptions resolved", async () => {
    await show(ana.id);
    await show(luis.id);
    await show(sam.id);
    const { data, error } = await busy();
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(COLUMNS);
      expect(row.person_id).toBe(ana.id);
    }
    const singles = rows
      .filter((r) => !r.recurrence)
      .map((r) => r.starts_at)
      .sort();
    expect(singles).toEqual([
      "2026-11-10T08:00:00+00:00",
      "2026-11-11T17:00:00+00:00",
      "2026-11-12T10:00:00+00:00",
    ]);
    const series = rows.find((r) => r.recurrence);
    expect(series?.recurrence).toBe("FREQ=WEEKLY");
    expect(series?.exdates).toEqual(["2026-11-09T17:00:00+00:00"]);
  });

  it("a stranger gets nothing", async () => {
    const { data } = await busy(sam.client);
    expect(data).toEqual([]);
  });

  it("rejects more than 32 days", async () => {
    const { error } = await busy(
      marta.client,
      "2026-11-01T00:00:00Z",
      "2026-12-04T00:00:00Z",
    );
    expect(error?.code).toBe("22023");
  });

  it("stops at once when unmarked or the consent is withdrawn (RF-4, RF-17)", async () => {
    await show(ana.id, false);
    expect((await busy()).data).toEqual([]);
    await show(ana.id);
    await consent(ana.id, false);
    expect((await busy()).data).toEqual([]);
    expect((await marta.client.rpc("busy_people")).data).toEqual([]);
    await consent(ana.id);
  });

  it("returns eight people at most (D5)", async () => {
    for (let i = 0; i < 8; i++) {
      const { data, error } = await admin.auth.admin.createUser({
        email: uniqueEmail(),
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: `Extra ${i}` },
      });
      if (error) throw error;
      extras.push(data.user.id);
    }
    const cals = await Promise.all(extras.map(getOwnCalendarId));
    await admin.from("profiles").update({ share_busy: true }).in("id", extras);
    const { error } = await admin.from("calendar_members").insert(
      extras.map((id) => ({
        calendar_id: martaCal,
        user_id: id,
        role: "viewer" as const,
      })),
    );
    if (error) throw error;
    const { error: eventsError } = await admin.from("events").insert(
      cals.map((calendar_id, i) => ({
        calendar_id,
        title: "Ocupado",
        starts_at: "2026-11-10T12:00:00Z",
        ends_at: "2026-11-10T13:00:00Z",
        created_by: extras[i],
      })),
    );
    if (eventsError) throw eventsError;
    for (const id of extras) await show(id);

    const people = new Set((await busy()).data?.map((r) => r.person_id));
    expect(people.size).toBe(8);
  });
});
