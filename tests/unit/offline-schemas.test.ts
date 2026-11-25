import { describe, expect, it } from "vitest";
import { offlineChangeSchema } from "@/lib/offline/schemas";

// Spec 035 T1 (RNF-3): the server only accepts well-formed changes.
const event = "11111111-1111-4111-8111-111111111111";
const calendar = "22222222-2222-4222-8222-222222222222";
const data = {
  title: "Clase",
  calendarId: calendar,
  allDay: false,
  startsAt: "2026-11-23T09:00:00.000Z",
  endsAt: "2026-11-23T10:00:00.000Z",
  description: null,
  location: null,
  color: null,
  categoryId: null,
};
const base = {
  fields: data,
  recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
  exdates: [],
  totals: {
    exceptions: 1,
    images: 0,
    comments: 2,
    latest: "2026-11-20T08:00:00.000Z",
  },
};
const ok = (change: unknown) => offlineChangeSchema.safeParse(change).success;

describe("offlineChangeSchema (spec 035 RNF-3)", () => {
  it("accepts the new kinds of change", () => {
    const occurrence = `${event}_20261123T090000Z`;
    const changes = [
      {
        type: "series.update",
        id: occurrence,
        scope: "this",
        base,
        data,
        repeat: "weekly",
      },
      {
        type: "series.update",
        id: event,
        scope: "all",
        base,
        data,
        repeat: "custom:FREQ=DAILY;INTERVAL=2",
      },
      { type: "series.delete", id: event, scope: "following", base },
      { type: "comment.add", eventId: event, clientId: calendar, body: "Hola" },
      {
        type: "comment.update",
        id: calendar,
        eventId: event,
        base: { body: "Hola" },
        body: "Adiós",
      },
      {
        type: "comment.delete",
        id: calendar,
        eventId: event,
        base: { body: "Hola" },
      },
      { type: "image.delete", id: calendar, eventId: occurrence },
      { type: "event.create", id: event, data, repeat: "monthly-day" },
      { type: "event.update", id: event, base: data, data, repeat: "none" },
    ];
    for (const change of changes) expect(ok(change), change.type).toBe(true);
  });

  it("rejects an empty comment and one of more than 1.000 characters", () => {
    const add = (body: string) => ({
      type: "comment.add",
      eventId: event,
      clientId: calendar,
      body,
    });
    expect(ok(add("   "))).toBe(false);
    expect(ok(add("a".repeat(1001)))).toBe(false);
    expect(ok(add("a".repeat(1000)))).toBe(true);
  });

  it("rejects an unknown scope", () => {
    expect(ok({ type: "series.delete", id: event, scope: "some", base })).toBe(
      false,
    );
  });

  it("rejects a malformed repeat", () => {
    expect(
      ok({ type: "event.create", id: event, data, repeat: "hourly" }),
    ).toBe(false);
    expect(
      ok({ type: "event.create", id: event, data, repeat: "custom:NOPE" }),
    ).toBe(false);
    expect(
      ok({
        type: "series.update",
        id: event,
        scope: "all",
        base,
        data,
        repeat: "",
      }),
    ).toBe(false);
  });

  it("does not take an image to add: images go by their own route (D5)", () => {
    expect(ok({ type: "image.add", eventId: event, localId: calendar })).toBe(
      false,
    );
  });
});

// Spec 048 T7 (RF-15): dates, the new order and the event of a note, offline.
describe("notes of spec 048", () => {
  const note = "33333333-3333-4333-8333-333333333333";
  const item = "44444444-4444-4444-8444-444444444444";
  const itemBase = { text: "Pan", done: false, dueDate: null, dueTime: null };

  it("accepts a due date with an hour, and an hour for the date it has", () => {
    const update = (change: object) => ({
      type: "item.update",
      noteId: note,
      id: item,
      base: itemBase,
      change,
    });
    expect(ok(update({ dueDate: "2026-12-03", dueTime: "18:30" }))).toBe(true);
    expect(ok(update({ dueDate: null, dueTime: null }))).toBe(true);
    // Only the database knows the date it has: an hour alone is its check (23514).
    expect(ok(update({ dueTime: "18:30" }))).toBe(true);
  });

  it("accepts a position between two", () => {
    expect(
      ok({
        type: "item.move",
        noteId: note,
        positions: [{ id: item, position: 0.75 }],
      }),
    ).toBe(true);
  });

  it("accepts the event or the repetition a note is made for", () => {
    const create = (eventId?: string) => ({
      type: "note.create",
      id: note,
      kind: "list",
      calendarId: null,
      fields: { title: "Qué llevar" },
      ...(eventId === undefined ? {} : { eventId }),
    });
    expect(ok(create())).toBe(true);
    expect(ok(create(event))).toBe(true);
    expect(ok(create(`${event}_20261210T190000Z`))).toBe(true);
    expect(ok(create("x; drop table"))).toBe(false);
  });
});
