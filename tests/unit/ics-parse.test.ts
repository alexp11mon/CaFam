// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseIcs, type IcsOccurrence } from "@/lib/ics/parse-ics";

// Reading the .ics and expanding repetitions (spec 004): RF-9, RF-13, RF-20,
// RF-22..RF-25, RF-28. Today is fixed so the one-year horizon is predictable.
const TODAY = { year: 2026, month: 10, day: 22 };
const HORIZON_LAST_DAY = "2027-10-22";

function calendar(events: string[], header = ""): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//EN",
    header,
    ...events,
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function event(lines: string[]): string {
  return ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
}

function parse(text: string) {
  const result = parseIcs(text, { today: TODAY });
  if (!result.ok) throw new Error(`parse failed: ${result.error}`);
  return result;
}

const day = (o: IcsOccurrence) =>
  `${o.start.year}-${String(o.start.month).padStart(2, "0")}-${String(o.start.day).padStart(2, "0")}`;

describe("parseIcs basics (RF-9, RF-13)", () => {
  it("returns the calendar name or null (RF-9)", () => {
    const named = parse(
      calendar(
        [event(["UID:a", "DTSTART:20261102T090000Z", "SUMMARY:x"])],
        "X-WR-CALNAME:Clases de la uni",
      ),
    );
    const unnamed = parse(
      calendar([event(["UID:a", "DTSTART:20261102T090000Z", "SUMMARY:x"])]),
    );

    expect(named.calendarName).toBe("Clases de la uni");
    expect(unnamed.calendarName).toBeNull();
  });

  it("reads title, description, location, start and end with their time zone (RF-13)", () => {
    const { occurrences } = parse(
      calendar([
        event([
          "UID:a",
          "DTSTART;TZID=Europe/Madrid:20261102T100000",
          "DTEND;TZID=Europe/Madrid:20261102T113000",
          "SUMMARY:Álgebra",
          "DESCRIPTION:Aula 3\\, planta 2\\nTraer calculadora",
          "LOCATION:Facultad de Matemáticas",
        ]),
      ]),
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      uid: "a",
      summary: "Álgebra",
      description: "Aula 3, planta 2\nTraer calculadora",
      location: "Facultad de Matemáticas",
      start: {
        year: 2026,
        month: 11,
        day: 2,
        hour: 10,
        minute: 0,
        second: 0,
        allDay: false,
        zone: { kind: "tzid", tzid: "Europe/Madrid" },
      },
      end: {
        hour: 11,
        minute: 30,
        zone: { kind: "tzid", tzid: "Europe/Madrid" },
      },
    });
  });

  it("tells UTC, floating and all-day values apart", () => {
    const { occurrences } = parse(
      calendar([
        event(["UID:u", "DTSTART:20261102T090000Z", "SUMMARY:utc"]),
        event(["UID:f", "DTSTART:20261102T090000", "SUMMARY:floating"]),
        event([
          "UID:d",
          "DTSTART;VALUE=DATE:20261201",
          "DTEND;VALUE=DATE:20261203",
          "SUMMARY:day",
        ]),
      ]),
    );
    const byUid = Object.fromEntries(occurrences.map((o) => [o.uid, o]));

    expect(byUid.u.start.zone).toEqual({ kind: "utc" });
    expect(byUid.f.start.zone).toEqual({ kind: "floating" });
    expect(byUid.d.start).toMatchObject({ allDay: true, day: 1, month: 12 });
    expect(byUid.d.end).toMatchObject({ allDay: true, day: 3, month: 12 });
  });

  it("does not invent an end, and reads DURATION as an end", () => {
    const { occurrences } = parse(
      calendar([
        event(["UID:n", "DTSTART:20261102T090000Z", "SUMMARY:no end"]),
        event([
          "UID:d",
          "DTSTART:20261102T090000Z",
          "DURATION:PT90M",
          "SUMMARY:duration",
        ]),
      ]),
    );
    const byUid = Object.fromEntries(occurrences.map((o) => [o.uid, o]));

    expect(byUid.n.end).toBeNull();
    expect(byUid.d.end).toMatchObject({ hour: 10, minute: 30 });
  });

  it("gives empty texts for missing properties", () => {
    const { occurrences } = parse(
      calendar([event(["UID:a", "DTSTART:20261102T090000Z"])]),
    );

    expect(occurrences[0]).toMatchObject({
      summary: "",
      description: "",
      location: "",
    });
  });

  it("counts events without a start as unreadable", () => {
    const result = parse(
      calendar([
        event(["UID:bad", "SUMMARY:no start"]),
        event(["UID:ok", "DTSTART:20261102T090000Z", "SUMMARY:ok"]),
      ]),
    );

    expect(result.occurrences).toHaveLength(1);
    expect(result.unreadable).toBe(1);
  });
});

describe("parseIcs cancelled events (RF-20)", () => {
  it("leaves cancelled events out and counts them", () => {
    const result = parse(
      calendar([
        event(["UID:a", "DTSTART:20261102T090000Z", "SUMMARY:ok"]),
        event([
          "UID:b",
          "DTSTART:20261103T090000Z",
          "STATUS:CANCELLED",
          "SUMMARY:cancelled",
        ]),
      ]),
    );

    expect(result.occurrences.map((o) => o.uid)).toEqual(["a"]);
    expect(result.cancelled).toBe(1);
  });

  it("drops a whole cancelled series with its exceptions", () => {
    const result = parse(
      calendar([
        event([
          "UID:s",
          "DTSTART:20261102T090000Z",
          "RRULE:FREQ=DAILY;COUNT=3",
          "STATUS:CANCELLED",
          "SUMMARY:series",
        ]),
        event([
          "UID:s",
          "RECURRENCE-ID:20261103T090000Z",
          "DTSTART:20261103T100000Z",
          "SUMMARY:moved",
        ]),
        event(["UID:a", "DTSTART:20261102T090000Z", "SUMMARY:ok"]),
      ]),
    );

    expect(result.occurrences.map((o) => o.uid)).toEqual(["a"]);
  });

  it("drops one cancelled repetition of a series", () => {
    const { occurrences } = parse(
      calendar([
        event([
          "UID:s",
          "DTSTART:20261102T090000Z",
          "RRULE:FREQ=DAILY;COUNT=3",
          "SUMMARY:series",
        ]),
        event([
          "UID:s",
          "RECURRENCE-ID:20261103T090000Z",
          "DTSTART:20261103T090000Z",
          "STATUS:CANCELLED",
          "SUMMARY:series",
        ]),
      ]),
    );

    expect(occurrences.map(day)).toEqual(["2026-11-02", "2026-11-04"]);
  });
});

describe("parseIcs repetitions (RF-22, RF-24, RF-25)", () => {
  it("creates one occurrence per repetition (RF-22)", () => {
    const { occurrences, cutSeries } = parse(
      calendar([
        event([
          "UID:w",
          "DTSTART;TZID=Europe/Madrid:20261102T100000",
          "DTEND;TZID=Europe/Madrid:20261102T110000",
          "RRULE:FREQ=WEEKLY;COUNT=4",
          "SUMMARY:Semanal",
        ]),
      ]),
    );

    expect(occurrences.map(day)).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
    ]);
    expect(occurrences.every((o) => o.summary === "Semanal")).toBe(true);
    expect(occurrences.every((o) => o.end?.hour === 11)).toBe(true);
    expect(cutSeries).toBe(0);
  });

  it("keeps the local time of each repetition across the clock change", () => {
    const { occurrences } = parse(
      calendar([
        event([
          "UID:w",
          "DTSTART;TZID=Europe/Madrid:20261019T100000",
          "RRULE:FREQ=WEEKLY;COUNT=3",
          "SUMMARY:x",
        ]),
      ]),
    );

    // The clock goes back on 2026-10-25: wall time stays 10:00 (RF-16, plan D2).
    expect(occurrences.map((o) => [day(o), o.start.hour])).toEqual([
      ["2026-10-19", 10],
      ["2026-10-26", 10],
      ["2026-11-02", 10],
    ]);
  });

  it("skips excluded repetitions (RF-24)", () => {
    const { occurrences } = parse(
      calendar([
        event([
          "UID:w",
          "DTSTART;TZID=Europe/Madrid:20261022T100000",
          "RRULE:FREQ=WEEKLY;COUNT=4",
          "EXDATE;TZID=Europe/Madrid:20261029T100000",
          "SUMMARY:x",
        ]),
      ]),
    );

    expect(occurrences.map(day)).toEqual([
      "2026-10-22",
      "2026-11-05",
      "2026-11-12",
    ]);
  });

  it("uses the modified version of a repetition, not the original (RF-25)", () => {
    const { occurrences } = parse(
      calendar([
        event([
          "UID:w",
          "DTSTART;TZID=Europe/Madrid:20261022T100000",
          "DTEND;TZID=Europe/Madrid:20261022T110000",
          "RRULE:FREQ=WEEKLY;COUNT=3",
          "SUMMARY:Semanal",
        ]),
        event([
          "UID:w",
          "RECURRENCE-ID;TZID=Europe/Madrid:20261029T100000",
          "DTSTART;TZID=Europe/Madrid:20261030T150000",
          "DTEND;TZID=Europe/Madrid:20261030T160000",
          "SUMMARY:Movida",
        ]),
      ]),
    );

    expect(occurrences.map((o) => [day(o), o.start.hour, o.summary])).toEqual([
      ["2026-10-22", 10, "Semanal"],
      ["2026-10-30", 15, "Movida"],
      ["2026-11-05", 10, "Semanal"],
    ]);
  });

  it("imports a modified repetition without its series as a plain event", () => {
    const { occurrences } = parse(
      calendar([
        event([
          "UID:orphan",
          "RECURRENCE-ID:20261029T100000Z",
          "DTSTART:20261030T150000Z",
          "SUMMARY:Suelta",
        ]),
      ]),
    );

    expect(occurrences.map((o) => [day(o), o.summary])).toEqual([
      ["2026-10-30", "Suelta"],
    ]);
  });

  it("expands all-day repetitions by days", () => {
    const { occurrences } = parse(
      calendar([
        event([
          "UID:d",
          "DTSTART;VALUE=DATE:20261201",
          "RRULE:FREQ=DAILY;COUNT=3",
          "SUMMARY:x",
        ]),
      ]),
    );

    expect(occurrences.map(day)).toEqual([
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
    ]);
    expect(occurrences.every((o) => o.start.allDay)).toBe(true);
  });
});

describe("parseIcs one-year horizon (RF-23)", () => {
  it("cuts an open-ended series one year after the import day", () => {
    const { occurrences, cutSeries } = parse(
      calendar([
        event([
          "UID:w",
          "DTSTART;TZID=Europe/Madrid:20261022T100000",
          "RRULE:FREQ=WEEKLY",
          "SUMMARY:x",
        ]),
      ]),
    );

    expect(occurrences[0] && day(occurrences[0])).toBe("2026-10-22");
    // 2026-10-22 + 52 weeks = 2027-10-21, the last one inside the year.
    expect(day(occurrences.at(-1)!)).toBe("2027-10-21");
    expect(occurrences).toHaveLength(53);
    expect(day(occurrences.at(-1)!) <= HORIZON_LAST_DAY).toBe(true);
    expect(cutSeries).toBe(1);
  });

  it("creates the past repetitions of a series that started long ago", () => {
    const { occurrences, cutSeries } = parse(
      calendar([
        event([
          "UID:w",
          "DTSTART;TZID=Europe/Madrid:20250106T100000",
          "RRULE:FREQ=WEEKLY",
          "SUMMARY:x",
        ]),
      ]),
    );

    expect(day(occurrences[0])).toBe("2025-01-06");
    expect(day(occurrences.at(-1)!)).toBe("2027-10-18");
    const weeks =
      (Date.UTC(2027, 9, 18) - Date.UTC(2025, 0, 6)) / (7 * 86_400_000) + 1;
    expect(occurrences).toHaveLength(weeks);
    expect(cutSeries).toBe(1);
  });

  it("imports a series that ended before the horizon in full", () => {
    const { occurrences, cutSeries } = parse(
      calendar([
        event([
          "UID:w",
          "DTSTART;TZID=Europe/Madrid:20200106T100000",
          "RRULE:FREQ=WEEKLY;UNTIL=20200301T000000Z",
          "SUMMARY:x",
        ]),
      ]),
    );

    expect(occurrences.map(day)).toEqual([
      "2020-01-06",
      "2020-01-13",
      "2020-01-20",
      "2020-01-27",
      "2020-02-03",
      "2020-02-10",
      "2020-02-17",
      "2020-02-24",
    ]);
    expect(cutSeries).toBe(0);
  });

  it("cuts a yearly all-day series and counts one cut series", () => {
    const { occurrences, cutSeries } = parse(
      calendar([
        event([
          "UID:b",
          "DTSTART;VALUE=DATE:20200101",
          "RRULE:FREQ=YEARLY",
          "SUMMARY:Cumpleaños",
        ]),
      ]),
    );

    // 2027-01-01 is inside the year; 2028-01-01 is not.
    expect(occurrences.map(day)).toEqual([
      "2020-01-01",
      "2021-01-01",
      "2022-01-01",
      "2023-01-01",
      "2024-01-01",
      "2025-01-01",
      "2026-01-01",
      "2027-01-01",
    ]);
    expect(cutSeries).toBe(1);
  });

  it("does not cut a one-off event that is far in the future", () => {
    const { occurrences, cutSeries } = parse(
      calendar([event(["UID:f", "DTSTART:20300101T090000Z", "SUMMARY:x"])]),
    );

    expect(occurrences).toHaveLength(1);
    expect(cutSeries).toBe(0);
  });

  it("counts each cut series once", () => {
    const { cutSeries } = parse(
      calendar([
        event(["UID:a", "DTSTART:20261022T100000Z", "RRULE:FREQ=WEEKLY"]),
        event(["UID:b", "DTSTART:20261022T100000Z", "RRULE:FREQ=DAILY"]),
        event([
          "UID:c",
          "DTSTART:20261022T100000Z",
          "RRULE:FREQ=DAILY;COUNT=3",
        ]),
      ]),
    );

    expect(cutSeries).toBe(2);
  });
});

describe("parseIcs pathological rules (plan R5)", () => {
  it("stops a very frequent series at the counting cap", () => {
    const started = Date.now();

    const result = parse(
      calendar([
        event(["UID:z", "DTSTART:20261022T100000Z", "RRULE:FREQ=SECONDLY"]),
      ]),
    );

    expect(result.capped).toBe(true);
    expect(result.occurrences.length).toBeGreaterThan(20_000);
    expect(result.occurrences.length).toBeLessThanOrEqual(20_001);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("terminates with a rule that never matches a real date", () => {
    const started = Date.now();

    const result = parse(
      calendar([
        event([
          "UID:z",
          "DTSTART:20260101T100000Z",
          "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30",
        ]),
      ]),
    );

    expect(result.occurrences.length).toBeLessThanOrEqual(20_001);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe("parseIcs errors (RF-28)", () => {
  it.each([
    "",
    "hola mundo",
    "<html><body>Login</body></html>",
    "BEGIN:VEVENT\r\nEND:VEVENT",
  ])("says not-ics for %j", (text) => {
    expect(parseIcs(text, { today: TODAY })).toEqual({
      ok: false,
      error: "not-ics",
    });
  });

  it("says no-events for a calendar without events", () => {
    expect(parseIcs(calendar([]), { today: TODAY })).toEqual({
      ok: false,
      error: "no-events",
    });
  });

  it("says no-events when every event is cancelled", () => {
    expect(
      parseIcs(
        calendar([
          event(["UID:a", "DTSTART:20261102T090000Z", "STATUS:CANCELLED"]),
        ]),
        { today: TODAY },
      ),
    ).toEqual({ ok: false, error: "no-events" });
  });
});
