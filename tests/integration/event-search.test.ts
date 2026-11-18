import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
  type TypedClient,
} from "./helpers";

// Spec 039, T2: search_events with RLS, accents and prefixes (RF-3, RF-4,
// RF-11).
let owner: TestUser;
let viewer: TestUser;
let expelled: TestUser;
let stranger: TestUser;
let calendarId: string;
const ids: Record<string, string> = {};
const FROM = "2026-01-01T00:00:00Z";
const TO = "2028-01-01T00:00:00Z";

async function add(title: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from("events")
    .insert({
      calendar_id: calendarId,
      title,
      starts_at: "2026-12-01T10:00:00Z",
      ends_at: "2026-12-01T11:00:00Z",
      created_by: owner.id,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  ids[title] = data.id;
}

async function search(client: TypedClient, query: string) {
  const { data, error } = await client.rpc("search_events", {
    p_query: query,
    p_from: FROM,
    p_to: TO,
  });
  return { rows: data ?? [], error };
}

function titlesOf(rows: { event_id: string }[]) {
  const byId = Object.fromEntries(
    Object.entries(ids).map(([t, id]) => [id, t]),
  );
  return rows.map((r) => byId[r.event_id]).sort();
}

beforeAll(async () => {
  [owner, viewer, expelled, stranger] = await Promise.all([
    createTestUser({ display_name: "Dueña" }),
    createTestUser({ display_name: "Lector" }),
    createTestUser({ display_name: "Expulsado" }),
    createTestUser({ display_name: "Ajeno" }),
  ]);
  calendarId = await getOwnCalendarId(owner.id);
  await admin.from("calendar_members").insert([
    { calendar_id: calendarId, user_id: viewer.id, role: "viewer" },
    { calendar_id: calendarId, user_id: expelled.id, role: "viewer" },
  ]);
  await add("Médico de cabecera");
  await add("Dentista");
  await add("Cena", { location: "Casa de la Abuela" });
  await add("Reunión", { description: "Llevar el 100% del informe" });
  await add("Comida");
  await add("Antiguo", {
    starts_at: "2020-01-01T10:00:00Z",
    ends_at: "2020-01-01T11:00:00Z",
  });
  await add("Serie de piano", {
    starts_at: "2020-01-02T17:00:00Z",
    ends_at: "2020-01-02T18:00:00Z",
    recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
    recurrence_tz: "Europe/Madrid",
  });
  await admin.from("event_comments").insert({
    event_id: ids.Comida,
    author_id: owner.id,
    body: "Traigo la tarta de ÑAME",
    client_id: crypto.randomUUID(),
  });
  await admin
    .from("calendar_members")
    .delete()
    .eq("calendar_id", calendarId)
    .eq("user_id", expelled.id);
});

afterAll(async () => {
  await Promise.all(
    [owner, viewer, expelled, stranger]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("search_events", () => {
  it("finds by title without accents or case, and by prefix (RF-3)", async () => {
    expect(titlesOf((await search(owner.client, "MEDICO")).rows)).toEqual([
      "Médico de cabecera",
    ]);
    expect(titlesOf((await search(owner.client, "denti")).rows)).toEqual([
      "Dentista",
    ]);
  });

  it("finds by place, description and comment, keeping ñ", async () => {
    expect(titlesOf((await search(owner.client, "abuela")).rows)).toEqual([
      "Cena",
    ]);
    expect(titlesOf((await search(owner.client, "100%")).rows)).toEqual([
      "Reunión",
    ]);
    const comment = await search(owner.client, "tarta ñame");
    expect(titlesOf(comment.rows)).toEqual(["Comida"]);
    expect(comment.rows[0].matched_comment).toBe("Traigo la tarta de ÑAME");
    expect((await search(owner.client, "name")).rows).toEqual([]);
  });

  it("needs every word and the period, but series that can fall in it", async () => {
    expect((await search(owner.client, "cena reunión")).rows).toEqual([]);
    expect((await search(owner.client, "antiguo")).rows).toEqual([]);
    expect(titlesOf((await search(owner.client, "piano")).rows)).toEqual([
      "Serie de piano",
    ]);
  });

  it("shows a Lector the events and nobody else (RF-4)", async () => {
    expect(titlesOf((await search(viewer.client, "dentista")).rows)).toEqual([
      "Dentista",
    ]);
    expect((await search(expelled.client, "dentista")).rows).toEqual([]);
    expect((await search(stranger.client, "dentista")).rows).toEqual([]);
    expect((await search(anonClient(), "dentista")).error?.code).toBe("42501");
  });
});
