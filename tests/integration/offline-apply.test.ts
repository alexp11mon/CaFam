import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyChange } from "@/app/dashboard/offline-writes";
import type { EventData } from "@/lib/calendar/schemas";
import { offlineChangeSchema, type ParsedChange } from "@/lib/offline/schemas";
import { occurrenceId } from "@/lib/recurrence/occurrence-id";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 034, T5: replaying a change made offline goes through the writes of
// always, with the user's session and RLS (RNF-5).
const TZ = "Europe/Madrid";

let ana: TestUser;
let luis: TestUser;
let anaCal: string;
let luisCal: string;
let syncedCal: string;

beforeAll(async () => {
  [ana, luis] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
  ]);
  [anaCal, luisCal] = await Promise.all(
    [ana, luis].map((u) => getOwnCalendarId(u.id)),
  );
  // Luis can read Ana's calendar but not write in it.
  const member = await admin
    .from("calendar_members")
    .insert({ calendar_id: anaCal, user_id: luis.id, role: "viewer" });
  if (member.error) throw member.error;

  const calendar = await admin
    .from("calendars")
    .insert({ owner_id: ana.id, name: "Google" })
    .select("id")
    .single();
  if (calendar.error) throw calendar.error;
  syncedCal = calendar.data.id;
  const connection = await admin
    .from("calendar_connections")
    .insert({
      owner_id: ana.id,
      provider: "google",
      account_subject: `sub-${randomUUID()}`,
      account_email: "ana@gmail.test",
    })
    .select("id")
    .single();
  if (connection.error) throw connection.error;
  const synced = await admin.from("synced_calendars").insert({
    calendar_id: syncedCal,
    connection_id: connection.data.id,
    provider: "google",
    external_id: `cal-${randomUUID()}`,
  });
  if (synced.error) throw synced.error;
});

afterAll(async () => {
  for (const user of [ana, luis]) if (user) await deleteTestUser(user.id);
  await deleteTestMail();
});

const data = (extra: Partial<EventData> = {}): EventData => ({
  title: "Dentista",
  calendarId: anaCal,
  allDay: false,
  startsAt: "2026-11-20T09:00:00+00:00",
  endsAt: "2026-11-20T10:00:00+00:00",
  description: null,
  location: null,
  color: null,
  categoryId: null,
  ...extra,
});

/** What the browser would send: validated like the server action does. */
const apply = (user: TestUser, change: unknown, force = false) =>
  applyChange(
    user.client,
    user.id,
    TZ,
    offlineChangeSchema.parse(change) as ParsedChange,
    force,
  );

async function seedEvent(extra: object = {}) {
  const { data: row, error } = await admin
    .from("events")
    .insert({
      calendar_id: anaCal,
      title: "Dentista",
      starts_at: "2026-11-20T09:00:00Z",
      ends_at: "2026-11-20T10:00:00Z",
      created_by: ana.id,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

const eventRow = async (id: string) =>
  (await admin.from("events").select("*").eq("id", id).maybeSingle()).data;

describe("events (RF-19, RF-21, RF-23, RF-41)", () => {
  it("creates with the browser's id, and a resend is still one event", async () => {
    const id = randomUUID();
    const change = { type: "event.create", id, data: data() };
    expect(await apply(ana, change)).toEqual({ status: "applied" });
    expect(await apply(ana, change)).toEqual({ status: "applied" });
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("id", id);
    expect(count).toBe(1);
    expect(await eventRow(id)).toMatchObject({ created_by: ana.id });
  });

  it("changes a single event, and a resend is applied with no write", async () => {
    const id = await seedEvent();
    const change = {
      type: "event.update",
      id,
      base: data(),
      data: data({ title: "Dentista (cambiado)" }),
    };
    expect(await apply(ana, change)).toEqual({ status: "applied" });
    expect(await apply(ana, change)).toEqual({ status: "applied" });
    expect(await eventRow(id)).toMatchObject({ title: "Dentista (cambiado)" });
  });

  it("keeps the server's description when the copy did not know it (R6)", async () => {
    const id = await seedEvent({ description: "Llevar la tarjeta" });
    const { description: _, ...partial } = data();
    void _;
    const result = await apply(ana, {
      type: "event.update",
      id,
      base: partial,
      data: { ...partial, title: "Revisión" },
    });
    expect(result).toEqual({ status: "applied" });
    expect(await eventRow(id)).toMatchObject({
      title: "Revisión",
      description: "Llevar la tarjeta",
    });
  });

  it("changes and deletes one occurrence of a series, only that one (RF-23)", async () => {
    const seriesId = await seedEvent({
      title: "Inglés",
      starts_at: "2026-11-23T17:00:00Z",
      ends_at: "2026-11-23T18:00:00Z",
      // As toRRule writes it: the rule is compared as text.
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=3",
      recurrence_tz: TZ,
      recurrence_until: "2026-12-07T18:00:00Z",
    });
    const second = occurrenceId(seriesId, "2026-11-30T17:00:00.000Z");
    const third = occurrenceId(seriesId, "2026-12-07T17:00:00.000Z");
    const base = (day: string) =>
      data({
        title: "Inglés",
        startsAt: `${day}T17:00:00+00:00`,
        endsAt: `${day}T18:00:00+00:00`,
      });

    const changed = await apply(ana, {
      type: "event.update",
      id: second,
      base: base("2026-11-30"),
      data: { ...base("2026-11-30"), title: "Inglés (examen)" },
    });
    expect(changed).toEqual({ status: "applied" });
    const deleted = await apply(ana, {
      type: "event.delete",
      id: third,
      base: base("2026-12-07"),
    });
    expect(deleted).toEqual({ status: "applied" });

    const series = await eventRow(seriesId);
    expect(series).toMatchObject({
      title: "Inglés",
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=3",
    });
    expect(series?.exdates).toEqual([expect.stringMatching(/^2026-12-07/)]);
    const { data: exceptions } = await admin
      .from("events")
      .select("title")
      .eq("series_id", seriesId);
    expect(exceptions).toEqual([{ title: "Inglés (examen)" }]);
  });

  it("deletes a single event, and deleting it again is applied", async () => {
    const id = await seedEvent();
    const change = { type: "event.delete", id, base: data() };
    expect(await apply(ana, change)).toEqual({ status: "applied" });
    expect(await eventRow(id)).toBeNull();
    expect(await apply(ana, change)).toEqual({ status: "applied" });
  });
});

describe("conflicts (RF-50 to RF-52, RF-58)", () => {
  it("asks when another person changed it, and force keeps mine", async () => {
    const id = await seedEvent();
    await admin.from("events").update({ title: "Médico" }).eq("id", id);
    const change = {
      type: "event.update",
      id,
      base: data(),
      data: data({ title: "Dentista a las 9" }),
    };
    expect(await apply(ana, change)).toMatchObject({
      status: "conflict",
      server: { title: "Médico" },
    });
    expect(await eventRow(id)).toMatchObject({ title: "Médico" });
    expect(await apply(ana, change, true)).toEqual({ status: "applied" });
    expect(await eventRow(id)).toMatchObject({ title: "Dentista a las 9" });
  });

  it("asks with server null when another person deleted it, and force recreates it with a new id", async () => {
    const id = await seedEvent();
    await admin.from("events").delete().eq("id", id);
    const result = await apply(ana, {
      type: "event.update",
      id,
      base: data(),
      data: data({ title: "Otra cosa" }),
    });
    expect(result).toEqual({ status: "conflict", server: null });

    const again = randomUUID();
    expect(
      await apply(
        ana,
        { type: "event.create", id: again, data: data({ title: "Otra cosa" }) },
        true,
      ),
    ).toEqual({ status: "applied" });
    expect(await eventRow(again)).toMatchObject({ title: "Otra cosa" });
  });

  it("asks before deleting one that another person changed", async () => {
    const id = await seedEvent();
    await admin.from("events").update({ location: "Centro" }).eq("id", id);
    const change = { type: "event.delete", id, base: data() };
    expect(await apply(ana, change)).toMatchObject({
      status: "conflict",
      server: { location: "Centro" },
    });
    expect(await apply(ana, change, true)).toEqual({ status: "applied" });
    expect(await eventRow(id)).toBeNull();
  });
});

describe("rejected changes (RF-47, RNF-5)", () => {
  it("a viewer is rejected with a message in Spanish", async () => {
    const id = await seedEvent();
    const result = await apply(luis, {
      type: "event.update",
      id,
      base: data(),
      data: data({ title: "No debería" }),
    });
    expect(result).toEqual({
      status: "rejected",
      reason: expect.stringMatching(/permiso/i),
    });
    const created = await apply(luis, {
      type: "event.create",
      id: randomUUID(),
      data: data(),
    });
    expect(created).toMatchObject({ status: "rejected" });
    expect(await eventRow(id)).toMatchObject({ title: "Dentista" });
  });

  it("someone who was expelled is rejected", async () => {
    const id = await seedEvent({ calendar_id: luisCal, created_by: luis.id });
    const joined = await admin
      .from("calendar_members")
      .insert({ calendar_id: luisCal, user_id: ana.id, role: "editor" });
    if (joined.error) throw joined.error;
    await admin
      .from("calendar_members")
      .delete()
      .eq("calendar_id", luisCal)
      .eq("user_id", ana.id);
    const result = await apply(ana, {
      type: "event.update",
      id,
      base: data({ calendarId: luisCal }),
      data: data({ calendarId: luisCal, title: "Ajeno" }),
    });
    expect(result).toEqual({
      status: "rejected",
      reason: expect.stringMatching(/permiso/i),
    });
    expect(await eventRow(id)).toMatchObject({ title: "Dentista" });
  });

  it("a calendar from Google is rejected", async () => {
    const result = await apply(ana, {
      type: "event.create",
      id: randomUUID(),
      data: data({ calendarId: syncedCal }),
    });
    expect(result).toEqual({
      status: "rejected",
      reason: expect.stringMatching(/Google/),
    });
  });
});

describe("notes (RF-31 to RF-34, RF-53 to RF-55)", () => {
  const fields = {
    title: "Compra",
    body: "",
    color: null,
    pinned: false,
    archived: false,
    dueDate: null,
  };

  it("creates a note with its fields, changes, and deletes it; resends are applied", async () => {
    const id = randomUUID();
    const create = {
      type: "note.create",
      id,
      kind: "list",
      calendarId: null,
      fields: { title: "Compra", pinned: true },
    };
    expect(await apply(ana, create)).toEqual({ status: "applied" });
    expect(await apply(ana, create)).toEqual({ status: "applied" });
    const row = async () =>
      (await admin.from("notes").select("*").eq("id", id).maybeSingle()).data;
    expect(await row()).toMatchObject({
      title: "Compra",
      pinned: true,
      owner_id: ana.id,
    });

    const base = { ...fields, pinned: true };
    expect(
      await apply(ana, {
        type: "note.update",
        id,
        base,
        fields: { body: "Leche", dueDate: "2026-11-30" },
      }),
    ).toEqual({ status: "applied" });
    expect(await row()).toMatchObject({
      body: "Leche",
      due_date: "2026-11-30",
    });

    // Someone else changed it after the copy: ask (RF-53).
    expect(
      await apply(ana, {
        type: "note.update",
        id,
        base,
        fields: { title: "Super" },
      }),
    ).toMatchObject({ status: "conflict", server: { body: "Leche" } });

    expect(
      await apply(ana, {
        type: "note.delete",
        id,
        base: { ...base, body: "Leche", dueDate: "2026-11-30" },
      }),
    ).toEqual({ status: "applied" });
    expect(await row()).toBeNull();
  });

  it("adds, changes, moves and deletes items; the order never asks (RF-54, RF-55)", async () => {
    const noteId = randomUUID();
    await apply(ana, {
      type: "note.create",
      id: noteId,
      kind: "list",
      calendarId: null,
      fields: { title: "Maleta" },
    });
    const [a, b] = [randomUUID(), randomUUID()];
    for (const [id, text, position] of [
      [a, "Cargador", 0],
      [b, "Gafas", 1],
    ] as const) {
      const add = { type: "item.add", noteId, id, text, position, done: false };
      expect(await apply(ana, add)).toEqual({ status: "applied" });
      expect(await apply(ana, add)).toEqual({ status: "applied" });
    }

    // Another person ticks the second one: changing the first one does not ask.
    await admin.from("note_items").update({ done: true }).eq("id", b);
    expect(
      await apply(ana, {
        type: "item.update",
        noteId,
        id: a,
        base: { text: "Cargador", done: false },
        change: { done: true },
      }),
    ).toEqual({ status: "applied" });
    // The same item, changed by both: ask.
    expect(
      await apply(ana, {
        type: "item.update",
        noteId,
        id: b,
        base: { text: "Gafas", done: false },
        change: { text: "Gafas de sol" },
      }),
    ).toMatchObject({ status: "conflict", server: { done: true } });

    expect(
      await apply(ana, {
        type: "item.move",
        noteId,
        positions: [
          { id: a, position: 1 },
          { id: b, position: 0 },
        ],
      }),
    ).toEqual({ status: "applied" });
    const { data: items } = await admin
      .from("note_items")
      .select("text, done")
      .eq("note_id", noteId)
      .order("position");
    expect(items).toEqual([
      { text: "Gafas", done: true },
      { text: "Cargador", done: true },
    ]);

    expect(
      await apply(ana, {
        type: "item.delete",
        noteId,
        id: a,
        base: { text: "Cargador", done: true },
      }),
    ).toEqual({ status: "applied" });
    expect(
      (await admin.from("note_items").select("id").eq("id", a)).data,
    ).toEqual([]);
  });

  it("the 200 items of a list are a limit: rejected in Spanish (CF429)", async () => {
    const noteId = randomUUID();
    await apply(ana, {
      type: "note.create",
      id: noteId,
      kind: "list",
      calendarId: null,
      fields: { title: "Larga" },
    });
    const filled = await admin.from("note_items").insert(
      Array.from({ length: 200 }, (_, position) => ({
        note_id: noteId,
        text: `Cosa ${position}`,
        position,
      })),
    );
    if (filled.error) throw filled.error;
    const result = await apply(ana, {
      type: "item.add",
      noteId,
      id: randomUUID(),
      text: "Una más",
      position: 200,
      done: false,
    });
    expect(result).toEqual({
      status: "rejected",
      reason: expect.stringMatching(/200 elementos/),
    });
  });

  it("a viewer cannot write a shared note", async () => {
    const result = await apply(luis, {
      type: "note.create",
      id: randomUUID(),
      kind: "text",
      calendarId: anaCal,
      fields: { title: "No" },
    });
    expect(result).toMatchObject({ status: "rejected" });
  });
});
