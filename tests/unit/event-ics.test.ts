import { describe, expect, it } from "vitest";
import { parseIcs } from "@/lib/ics/parse-ics";
import { eventIcs, icsFileName } from "@/lib/share/event-ics";

const now = new Date("2026-11-18T10:00:00Z");
const today = { year: 2026, month: 11, day: 18 };

describe("eventIcs (spec 047 RF-1)", () => {
  it("writes one event that reads back the same", () => {
    const { filename, text } = eventIcs(
      {
        id: "8f0c3a52-4c1e-4f7a-9f10-7c3a5d1e2b40",
        title: "Cena con Ana",
        startsAt: "2026-11-20T20:00:00Z",
        endsAt: "2026-11-20T22:00:00Z",
        allDay: false,
        location: "Casa de Ana",
        description: "Llevar postre",
      },
      now,
    );
    expect(filename).toBe("cena-con-ana.ics");
    const parsed = parseIcs(text, { today });
    if (!parsed.ok) throw new Error("not parsed");
    expect(parsed.occurrences).toHaveLength(1);
    expect(parsed.occurrences[0]).toMatchObject({
      summary: "Cena con Ana",
      location: "Casa de Ana",
      description: "Llevar postre",
      start: { year: 2026, month: 11, day: 20, hour: 20, allDay: false },
    });
  });

  it("keeps an all-day event as dates and an occurrence id as its uid", () => {
    const { text } = eventIcs(
      {
        id: "8f0c3a52-4c1e-4f7a-9f10-7c3a5d1e2b40_20261207T000000Z",
        title: "Puente",
        startsAt: "2026-12-07T00:00:00Z",
        endsAt: "2026-12-09T00:00:00Z",
        allDay: true,
        location: null,
        description: null,
      },
      now,
    );
    expect(text).toContain("DTSTART;VALUE=DATE:20261207");
    expect(text).toContain("DTEND;VALUE=DATE:20261209");
    expect(text).toContain(
      "UID:8f0c3a52-4c1e-4f7a-9f10-7c3a5d1e2b40_20261207T000000Z@cafam",
    );
    const parsed = parseIcs(text, { today });
    expect(parsed.ok && parsed.occurrences[0].start.allDay).toBe(true);
  });
});

describe("icsFileName", () => {
  it("drops accents and symbols", () => {
    expect(icsFileName("Cumpleaños de José!")).toBe("cumpleanos-de-jose.ics");
  });

  it("falls back for a title without letters", () => {
    expect(icsFileName("¿?")).toBe("evento.ics");
  });
});
