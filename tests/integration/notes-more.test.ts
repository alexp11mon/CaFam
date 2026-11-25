import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 048, T1: due dates per item, fractional order, a note's event and the
// tasks of the calendar (RF-1, RF-5, RF-8, RF-11).
let owner: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let calendar: string;
let strangerCalendar: string;

beforeAll(async () => {
  [owner, viewer, stranger] = await Promise.all([
    createTestUser({ display_name: "Olga" }),
    createTestUser({ display_name: "Vic" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  [calendar, strangerCalendar] = await Promise.all([
    getOwnCalendarId(owner.id),
    getOwnCalendarId(stranger.id),
  ]);
  const { error } = await admin
    .from("calendar_members")
    .insert({ calendar_id: calendar, user_id: viewer.id, role: "viewer" });
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all(
    [owner, viewer, stranger].map((user) =>
      deleteTestUser(user.id).catch(() => {}),
    ),
  );
});

async function note(
  user: TestUser,
  fields: { calendar_id?: string; event_id?: string; title?: string } = {},
) {
  const id = randomUUID();
  const { error } = await user.client
    .from("notes")
    .insert({ id, title: "Compra", ...fields });
  if (error) throw error;
  return id;
}

async function event(calendarId: string, createdBy: string) {
  const { data, error } = await admin
    .from("events")
    .insert({
      calendar_id: calendarId,
      title: "Cena",
      starts_at: "2026-12-10T19:00:00Z",
      ends_at: "2026-12-10T21:00:00Z",
      all_day: false,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("items", () => {
  it("keep a due date and time, never a time without a date", async () => {
    const id = await note(owner);
    const { data, error } = await owner.client
      .from("note_items")
      .insert({
        note_id: id,
        text: "Pan",
        due_date: "2026-12-01",
        due_time: "18:30",
      })
      .select("due_date, due_time")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ due_date: "2026-12-01", due_time: "18:30:00" });

    const bad = await owner.client
      .from("note_items")
      .insert({ note_id: id, text: "Leche", due_time: "10:00" });
    expect(bad.error?.code).toBe("23514");
  });

  it("move with a fractional position, written in one row", async () => {
    const id = await note(owner);
    await owner.client.from("note_items").insert([
      { note_id: id, text: "a", position: 0 },
      { note_id: id, text: "b", position: 1 },
    ]);
    const { data: c } = await owner.client
      .from("note_items")
      .insert({ note_id: id, text: "c", position: 0.5 })
      .select("position")
      .single();
    expect(c?.position).toBe(0.5);
    const { data } = await owner.client
      .from("note_items")
      .select("text")
      .eq("note_id", id)
      .order("position");
    expect(data?.map((row) => row.text)).toEqual(["a", "c", "b"]);
  });
});

describe("the event of a note", () => {
  it("links a shared note to an event of its calendar, and deleting it unlinks", async () => {
    const eventId = await event(calendar, owner.id);
    const id = await note(owner, { calendar_id: calendar, event_id: eventId });
    // Readers of the calendar see the link.
    const { data: seen } = await viewer.client
      .from("notes")
      .select("event_id")
      .eq("id", id)
      .single();
    expect(seen?.event_id).toBe(eventId);

    await admin.from("events").delete().eq("id", eventId);
    const { data: after } = await admin
      .from("notes")
      .select("id, event_id")
      .eq("id", id)
      .single();
    expect(after).toEqual({ id, event_id: null });
  });

  it("rejects an event of another calendar for a shared note", async () => {
    const other = await event(strangerCalendar, stranger.id);
    await admin.from("calendar_members").insert({
      calendar_id: strangerCalendar,
      user_id: owner.id,
      role: "viewer",
    });
    const { error } = await owner.client
      .from("notes")
      .insert({ title: "x", calendar_id: calendar, event_id: other });
    expect(error?.code).toBe("22023");
    // A personal note may link to any event its author sees.
    const personal = await owner.client
      .from("notes")
      .insert({ title: "y", event_id: other });
    expect(personal.error).toBeNull();
    await admin
      .from("calendar_members")
      .delete()
      .eq("calendar_id", strangerCalendar)
      .eq("user_id", owner.id);
  });

  it("rejects an event the author cannot see", async () => {
    const hidden = await event(strangerCalendar, stranger.id);
    const { error } = await owner.client
      .from("notes")
      .insert({ title: "z", event_id: hidden });
    expect(error?.code).toBe("CF404");
  });
});

describe("calendar_tasks", () => {
  it("returns pending dated notes and items the user sees, of visible calendars", async () => {
    const personal = await note(owner, { title: "Regalos" });
    await owner.client
      .from("notes")
      .update({ due_date: "2026-12-05" })
      .eq("id", personal);
    const shared = await note(owner, {
      calendar_id: calendar,
      title: "Compra",
    });
    // One insert needs the same keys in every row (PostgREST).
    const items = await owner.client.from("note_items").insert([
      {
        note_id: shared,
        text: "Pan",
        done: false,
        due_date: "2026-12-03",
        due_time: "09:00",
      },
      {
        note_id: shared,
        text: "Hecho",
        done: true,
        due_date: "2026-12-03",
        due_time: null,
      },
      {
        note_id: shared,
        text: "Fuera",
        done: false,
        due_date: "2027-01-10",
        due_time: null,
      },
    ]);
    expect(items.error).toBeNull();
    const range = { p_from: "2026-12-01", p_to: "2026-12-31" };

    const mine = await owner.client.rpc("calendar_tasks", range);
    expect(mine.error).toBeNull();
    const texts = (mine.data ?? []).map((row) => row.text);
    expect(texts).toContain("Pan");
    expect(texts).toContain("Regalos");
    expect(texts).not.toContain("Hecho");
    expect(texts).not.toContain("Fuera");

    // The viewer sees the shared one, never the personal one.
    const theirs = await viewer.client.rpc("calendar_tasks", range);
    const theirTexts = (theirs.data ?? []).map((row) => row.text);
    expect(theirTexts).toContain("Pan");
    expect(theirTexts).not.toContain("Regalos");

    // Hidden in the filters: not shown (RF-8).
    const pref = await viewer.client.from("calendar_preferences").upsert({
      user_id: viewer.id,
      calendar_id: calendar,
      visible: false,
    });
    expect(pref.error).toBeNull();
    const hidden = await viewer.client.rpc("calendar_tasks", range);
    expect((hidden.data ?? []).map((row) => row.text)).not.toContain("Pan");

    expect(
      (await stranger.client.rpc("calendar_tasks", range)).data ?? [],
    ).toEqual([]);
  });
});

describe("profiles.show_tasks", () => {
  it("starts off", async () => {
    const { data } = await owner.client
      .from("profiles")
      .select("show_tasks")
      .eq("id", owner.id)
      .single();
    expect(data).toEqual({ show_tasks: false });
  });
});
