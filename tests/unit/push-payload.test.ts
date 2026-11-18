import { describe, expect, it } from "vitest";
import { reminderPayload, socialPayload } from "@/lib/push/payload";

// Spec 040, T2: what each notice says and where it goes (RF-11, RF-13).
const now = new Date("2026-11-20T17:20:00Z");

describe("reminderPayload", () => {
  const event = {
    eventId: "e1",
    title: "Cena",
    location: "Calle Mayor 3",
    startsAt: "2026-11-20T17:30:00Z",
    allDay: false,
  };

  it("says today, the hour and the place, and opens the detail", () => {
    expect(reminderPayload(event, "Europe/Madrid", now)).toEqual({
      title: "Cena",
      body: "Hoy a las 18:30 · en Calle Mayor 3",
      url: "/dashboard/events/e1",
      tag: "event:e1",
    });
  });

  it("says tomorrow or the date, and no place when there is none", () => {
    expect(
      reminderPayload(
        { ...event, location: null, startsAt: "2026-11-21T08:00:00Z" },
        "Europe/Madrid",
        now,
      ).body,
    ).toBe("Mañana a las 9:00");
    expect(
      reminderPayload(
        { ...event, location: null, startsAt: "2026-11-27T08:00:00Z" },
        "Europe/Madrid",
        now,
      ).body,
    ).toBe("Viernes, 27 de noviembre a las 9:00");
  });

  it("says all day for all-day events", () => {
    expect(
      reminderPayload(
        { ...event, allDay: true, startsAt: "2026-11-21T00:00:00Z" },
        "Europe/Madrid",
        now,
      ).body,
    ).toBe("Mañana · todo el día · en Calle Mayor 3");
  });
});

describe("socialPayload", () => {
  it("names who did what", () => {
    expect(
      socialPayload({
        kind: "joined",
        actor: "Ana",
        calendar: "Familia",
        calendarId: "c1",
      }),
    ).toMatchObject({
      title: "Familia",
      body: "Ana se ha unido al calendario",
    });
    expect(
      socialPayload({
        kind: "access",
        actor: "Ana",
        calendar: "Familia",
        calendarId: "c1",
        role: "editor",
      }),
    ).toMatchObject({ body: "Ana te ha dado acceso como Editor" });
    expect(
      socialPayload({
        kind: "comment",
        actor: "Ana",
        title: "Cena",
        eventId: "e1",
        body: "Llevo el postre",
      }),
    ).toEqual({
      title: "Cena",
      body: "Ana: Llevo el postre",
      url: "/dashboard/events/e1",
      tag: "comment:e1",
    });
    expect(
      socialPayload({
        kind: "changed",
        actor: "Ana",
        title: "Cena",
        eventId: "e1",
      }),
    ).toMatchObject({ body: "Ana ha cambiado el evento" });
    expect(
      socialPayload({
        kind: "deleted",
        actor: "Ana",
        title: "Cena",
        eventId: "e1",
      }),
    ).toMatchObject({
      body: "Ana ha borrado el evento",
      url: "/dashboard/calendar",
    });
  });

  it("cuts long comments", () => {
    const body = socialPayload({
      kind: "comment",
      actor: "Ana",
      title: "Cena",
      eventId: "e1",
      body: "a".repeat(500),
    }).body;
    expect(body.length).toBeLessThanOrEqual(160);
    expect(body.endsWith("…")).toBe(true);
  });
});
