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
