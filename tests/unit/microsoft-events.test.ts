import { describe, expect, it } from "vitest";
import { convertMicrosoftEvents } from "@/lib/sync/microsoft-events";
import fixture from "../fixtures/sync/microsoft-events.json";

// Spec 007, T5: Microsoft Graph events to rows (RF-16, RF-17, RF-18; plan R8).
const { events, skipped } = convertMicrosoftEvents(fixture.value);
const byId = (id: string) => events.find((e) => e.external_id === id);

describe("convertMicrosoftEvents", () => {
  it("converts a timed event asked in UTC", () => {
    expect(byId("AAMk-timed1")).toEqual({
      external_id: "AAMk-timed1",
      title: "Reunión",
      description: "Orden del día",
      location: "Sala 2",
      starts_at: "2026-11-02T09:00:00.000Z",
      ends_at: "2026-11-02T10:30:00.000Z",
      all_day: false,
    });
  });

  it("keeps an all-day event from 00:00 UTC to 00:00 UTC of the next day (R8)", () => {
    expect(byId("AAMk-allday1")).toMatchObject({
      starts_at: "2026-11-05T00:00:00.000Z",
      ends_at: "2026-11-06T00:00:00.000Z",
      all_day: true,
      description: null,
      location: null,
    });
    expect(byId("AAMk-multi1")).toMatchObject({
      starts_at: "2026-12-01T00:00:00.000Z",
      ends_at: "2026-12-04T00:00:00.000Z",
    });
  });

  it("gives an untitled event a title", () => {
    expect(byId("AAMk-notitle1")?.title).toBe("(Sin título)");
  });

  it("drops cancelled events and counts the invalid ones (RF-18)", () => {
    expect(byId("AAMk-cancelled1")).toBeUndefined();
    expect(byId("AAMk-backwards1")).toBeUndefined();
    expect(byId("AAMk-unknownzone1")).toBeUndefined();
    expect(skipped).toBe(2);
  });

  it("keeps each occurrence with its own id (RF-16)", () => {
    expect(byId("AAMk-occ-1")?.starts_at).toBe("2026-11-09T09:00:00.000Z");
    expect(byId("AAMk-occ-2")).toMatchObject({
      title: "Clase (cambiada)",
      starts_at: "2026-11-16T11:00:00.000Z",
    });
  });

  it("converts a known IANA zone when the event is not in UTC", () => {
    const [row] = convertMicrosoftEvents([
      {
        id: "madrid",
        subject: "Cena",
        isAllDay: false,
        start: {
          dateTime: "2026-11-02T21:00:00.0000000",
          timeZone: "Europe/Madrid",
        },
        end: {
          dateTime: "2026-11-02T22:00:00.0000000",
          timeZone: "Europe/Madrid",
        },
      },
    ]).events;
    expect(row.starts_at).toBe("2026-11-02T20:00:00.000Z");
  });

  it("cuts long texts to the table limits", () => {
    const [row] = convertMicrosoftEvents([
      {
        id: "long",
        subject: "t".repeat(150),
        body: { content: "d".repeat(2500) },
        location: { displayName: "l".repeat(300) },
        isAllDay: true,
        start: { dateTime: "2026-11-01T00:00:00.0000000", timeZone: "UTC" },
        end: { dateTime: "2026-11-02T00:00:00.0000000", timeZone: "UTC" },
      },
    ]).events;
    expect(row.title).toHaveLength(100);
    expect(row.description).toHaveLength(2000);
    expect(row.location).toHaveLength(200);
  });
});
