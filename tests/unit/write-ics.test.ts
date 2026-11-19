import { describe, expect, it } from "vitest";
import { convertOccurrences } from "@/lib/ics/convert-events";
import { parseIcs } from "@/lib/ics/parse-ics";
import { writeIcs, type IcsRow } from "@/lib/ics/write-ics";

// Spec 043, T1: writing a calendar as .ics (RF-3..RF-6).
const NOW = new Date("2026-11-19T10:00:00Z");

function row(extra: Partial<IcsRow> & Pick<IcsRow, "id">): IcsRow {
  return {
    title: "Evento",
    description: null,
    location: null,
    starts_at: "2026-11-20T17:00:00Z",
    ends_at: "2026-11-20T18:00:00Z",
    all_day: false,
    recurrence: null,
    recurrence_tz: null,
    exdates: null,
    series_id: null,
    original_start: null,
    created_at: "2026-11-01T08:00:00Z",
    updated_at: "2026-11-02T09:30:00Z",
    ...extra,
  };
}

/** Unfolded content lines. */
function lines(text: string): string[] {
  return text.replace(/\r\n /g, "").split("\r\n");
}

describe("writeIcs", () => {
  it("writes the calendar and a timed event in UTC", () => {
    const text = writeIcs({
      name: "Familia",
      rows: [row({ id: "a1", title: "Cena, con; todos", location: "Casa" })],
      now: NOW,
    });
    expect(text.endsWith("\r\n")).toBe(true);
    const all = lines(text);
    expect(all.slice(0, 2)).toEqual(["BEGIN:VCALENDAR", "VERSION:2.0"]);
    expect(all).toContain("X-WR-CALNAME:Familia");
    expect(all).toContain("UID:a1@cafam");
    expect(all).toContain("DTSTAMP:20261119T100000Z");
    expect(all).toContain("DTSTART:20261120T170000Z");
    expect(all).toContain("DTEND:20261120T180000Z");
    expect(all).toContain("SUMMARY:Cena\\, con\\; todos");
    expect(all).toContain("LOCATION:Casa");
    expect(all).toContain("CREATED:20261101T080000Z");
    expect(all).toContain("LAST-MODIFIED:20261102T093000Z");
    expect(all.some((line) => line.startsWith("DESCRIPTION"))).toBe(false);
    expect(all.at(-2)).toBe("END:VCALENDAR");
  });

  it("writes all-day events as dates with an exclusive end", () => {
    const all = lines(
      writeIcs({
        name: "C",
        rows: [
          row({
            id: "d1",
            all_day: true,
            starts_at: "2026-12-24T00:00:00Z",
            ends_at: "2026-12-27T00:00:00Z",
          }),
        ],
        now: NOW,
      }),
    );
    expect(all).toContain("DTSTART;VALUE=DATE:20261224");
    expect(all).toContain("DTEND;VALUE=DATE:20261227");
  });

  it("writes a series with its zone, exdates and an exception", () => {
    const all = lines(
      writeIcs({
        name: "C",
        rows: [
          row({
            id: "s1",
            starts_at: "2026-11-05T17:00:00Z",
            ends_at: "2026-11-05T18:00:00Z",
            recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH;UNTIL=20261231T235959",
            recurrence_tz: "Europe/Madrid",
            exdates: ["2026-11-12T17:00:00Z"],
          }),
          row({
            id: "x1",
            title: "Movido",
            series_id: "s1",
            original_start: "2026-11-19T17:00:00Z",
            starts_at: "2026-11-19T19:00:00Z",
            ends_at: "2026-11-19T20:00:00Z",
          }),
        ],
        now: NOW,
      }),
    );
    expect(all).toContain("TZID:Europe/Madrid");
    expect(all).toContain("DTSTART;TZID=Europe/Madrid:20261105T180000");
    expect(all).toContain("DTEND;TZID=Europe/Madrid:20261105T190000");
    // UNTIL in UTC when DTSTART has a zone (RFC 5545).
    expect(all).toContain(
      "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TH;UNTIL=20261231T225959Z",
    );
    expect(all).toContain("EXDATE;TZID=Europe/Madrid:20261112T180000");
    expect(all).toContain("RECURRENCE-ID;TZID=Europe/Madrid:20261119T180000");
    expect(all.filter((line) => line === "UID:s1@cafam")).toHaveLength(2);
    expect(all).toContain("DTSTART:20261119T190000Z");
  });

  it("writes an all-day series with dates", () => {
    const all = lines(
      writeIcs({
        name: "C",
        rows: [
          row({
            id: "b1",
            all_day: true,
            starts_at: "2026-03-10T00:00:00Z",
            ends_at: "2026-03-11T00:00:00Z",
            recurrence: "FREQ=YEARLY;INTERVAL=1;BYMONTH=3;BYMONTHDAY=10",
            exdates: ["2027-03-10T00:00:00Z"],
          }),
        ],
        now: NOW,
      }),
    );
    expect(all).toContain("DTSTART;VALUE=DATE:20260310");
    expect(all).toContain("EXDATE;VALUE=DATE:20270310");
    expect(all.some((line) => line.startsWith("BEGIN:VTIMEZONE"))).toBe(false);
  });

  it("adds the calendar name as a category when given", () => {
    const all = lines(
      writeIcs({
        name: "CaFam",
        rows: [row({ id: "c1", category: "Trabajo, casa" })],
        now: NOW,
      }),
    );
    expect(all).toContain("CATEGORIES:Trabajo\\, casa");
  });

  it("reads back the same events with parse-ics (RF-6)", () => {
    const rows: IcsRow[] = [];
    for (let i = 0; i < 16; i++) {
      const day = String(1 + i).padStart(2, "0");
      rows.push(
        row({
          id: `e${i}`,
          title: `Evento ${i}: ñ, ü; \\ "comillas"${i % 3 === 0 ? "\nsegunda línea" : ""}`,
          description: i % 2 ? `Descripción larga ${"é".repeat(90)}` : null,
          location: i % 4 ? null : "Calle Mayor, 1",
          starts_at: `2026-12-${day}T0${i % 10}:15:00Z`,
          ends_at: `2026-12-${day}T1${i % 10}:45:00Z`,
          all_day: false,
        }),
      );
    }
    rows.push(
      row({
        id: "allday",
        title: "Vacaciones",
        all_day: true,
        starts_at: "2026-12-22T00:00:00Z",
        ends_at: "2026-12-25T00:00:00Z",
      }),
      row({
        id: "series",
        title: "Clase",
        starts_at: "2026-11-05T17:00:00Z",
        ends_at: "2026-11-05T18:00:00Z",
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH;COUNT=4",
        recurrence_tz: "Europe/Madrid",
        exdates: ["2026-11-12T17:00:00Z"],
      }),
      row({
        id: "moved",
        title: "Clase movida",
        series_id: "series",
        original_start: "2026-11-19T17:00:00Z",
        starts_at: "2026-11-19T19:00:00Z",
        ends_at: "2026-11-19T20:00:00Z",
      }),
      row({
        id: "zero",
        title: "Recordatorio",
        starts_at: "2026-12-31T23:00:00Z",
        ends_at: "2026-12-31T23:00:00Z",
      }),
    );
    expect(rows).toHaveLength(20);

    const parsed = parseIcs(writeIcs({ name: "Familia", rows, now: NOW }), {
      today: { year: 2026, month: 11, day: 19 },
    });
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.calendarName).toBe("Familia");
    const { events, skipped } = convertOccurrences(
      parsed.occurrences,
      "Europe/Madrid",
    );
    expect(skipped).toBe(0);

    const key = (e: {
      title: string;
      starts_at: string;
      ends_at: string;
      all_day: boolean;
      description?: string | null;
      location?: string | null;
    }) =>
      [
        e.title,
        new Date(e.starts_at).toISOString(),
        new Date(e.ends_at).toISOString(),
        e.all_day,
        e.description ?? null,
        e.location ?? null,
      ].join("|");

    const expected = rows.filter((r) => !r.recurrence && !r.series_id).map(key);
    // The series: 5, 12 (deleted), 19 (moved) and 26 November.
    expected.push(
      key({
        title: "Clase",
        starts_at: "2026-11-05T17:00:00Z",
        ends_at: "2026-11-05T18:00:00Z",
        all_day: false,
      }),
      key({
        title: "Clase movida",
        starts_at: "2026-11-19T19:00:00Z",
        ends_at: "2026-11-19T20:00:00Z",
        all_day: false,
      }),
      key({
        title: "Clase",
        starts_at: "2026-11-26T17:00:00Z",
        ends_at: "2026-11-26T18:00:00Z",
        all_day: false,
      }),
    );
    expect(events.map(key).sort()).toEqual(expected.sort());
  });

  it("writes 2,000 events quickly (RNF-2)", () => {
    const rows = Array.from({ length: 2000 }, (_, i) =>
      row({ id: `r${i}`, title: `Evento ${i}`, description: "x".repeat(300) }),
    );
    const started = performance.now();
    writeIcs({ name: "C", rows, now: NOW });
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
