import { describe, expect, it } from "vitest";
import { convertOccurrences } from "@/lib/ics/convert-events";
import type { IcsOccurrence, IcsTime, IcsZone } from "@/lib/ics/parse-ics";

const MADRID = "Europe/Madrid";

function time(
  date: string,
  clock = "00:00:00",
  zone: IcsZone = { kind: "floating" },
  allDay = false,
): IcsTime {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = clock.split(":").map(Number);
  return { year, month, day, hour, minute, second, allDay, zone };
}

function timed(
  start: string,
  end: string | null,
  zone: IcsZone,
  overrides: Partial<IcsOccurrence> = {},
): IcsOccurrence {
  const [startDate, startClock] = start.split(" ");
  return {
    uid: "u",
    summary: "Evento",
    description: "",
    location: "",
    start: time(startDate, startClock, zone),
    end: end ? time(end.split(" ")[0], end.split(" ")[1], zone) : null,
    ...overrides,
  };
}

function allDay(
  start: string,
  end: string | null,
  overrides: Partial<IcsOccurrence> = {},
): IcsOccurrence {
  return {
    uid: "u",
    summary: "Día",
    description: "",
    location: "",
    start: time(start, "00:00:00", { kind: "floating" }, true),
    end: end ? time(end, "00:00:00", { kind: "floating" }, true) : null,
    ...overrides,
  };
}

function convert(occurrences: IcsOccurrence[], timeZone = MADRID) {
  return convertOccurrences(occurrences, timeZone);
}

const madrid: IcsZone = { kind: "tzid", tzid: "Europe/Madrid" };

describe("convertOccurrences time zones (RF-16, RF-21)", () => {
  it("stores a TZID event as the right UTC instant, winter and summer", () => {
    const { events } = convert([
      timed("2026-11-02 10:00:00", "2026-11-02 11:30:00", madrid),
      timed("2026-07-01 10:00:00", "2026-07-01 11:00:00", madrid),
    ]);

    expect(events.map((e) => [e.starts_at, e.ends_at])).toEqual([
      ["2026-11-02T09:00:00.000Z", "2026-11-02T10:30:00.000Z"],
      ["2026-07-01T08:00:00.000Z", "2026-07-01T09:00:00.000Z"],
    ]);
  });

  it("keeps the wall time of a series across the clock change", () => {
    const { events } = convert([
      timed("2026-10-19 10:00:00", null, madrid),
      timed("2026-10-26 10:00:00", null, madrid),
    ]);

    // Summer time (UTC+2) before 2026-10-25, winter time (UTC+1) after.
    expect(events.map((e) => e.starts_at)).toEqual([
      "2026-10-19T08:00:00.000Z",
      "2026-10-26T09:00:00.000Z",
    ]);
  });

  it("keeps UTC values as they are", () => {
    const { events } = convert([
      timed("2026-11-02 09:00:00", "2026-11-02 10:00:00", { kind: "utc" }),
    ]);

    expect(events[0].starts_at).toBe("2026-11-02T09:00:00.000Z");
    expect(events[0].ends_at).toBe("2026-11-02T10:00:00.000Z");
  });

  it("reads a floating time in the profile zone (plan D3)", () => {
    const { events } = convert(
      [timed("2026-11-02 10:00:00", null, { kind: "floating" })],
      "America/Bogota",
    );

    expect(events[0].starts_at).toBe("2026-11-02T15:00:00.000Z");
  });

  it("keeps the seconds", () => {
    const { events } = convert([
      timed("2026-11-02 10:00:30", null, { kind: "utc" }),
    ]);

    expect(events[0].starts_at).toBe("2026-11-02T10:00:30.000Z");
  });

  it("leaves out events with an unknown zone and counts them (RF-21)", () => {
    const { events, skipped } = convert([
      timed("2026-11-02 10:00:00", null, {
        kind: "tzid",
        tzid: "Romance Standard Time",
      }),
      timed("2026-11-03 10:00:00", null, madrid),
      timed("2026-11-04 10:00:00", null, {
        kind: "tzid",
        tzid: "Mars/Olympus",
      }),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].starts_at).toBe("2026-11-03T09:00:00.000Z");
    expect(skipped).toBe(2);
  });
});

describe("convertOccurrences all-day events (RF-17, RF-19)", () => {
  it("stores the day with the spec 002 convention", () => {
    const { events } = convert([allDay("2026-12-01", "2026-12-02")]);

    expect(events[0]).toMatchObject({
      all_day: true,
      starts_at: "2026-12-01T00:00:00.000Z",
      ends_at: "2026-12-02T00:00:00.000Z",
    });
  });

  it("keeps a multi-day event as one event", () => {
    const { events } = convert([allDay("2026-12-01", "2026-12-04")]);

    expect(events).toHaveLength(1);
    expect(events[0].ends_at).toBe("2026-12-04T00:00:00.000Z");
  });

  it("lasts one day when there is no end (RF-19)", () => {
    const { events } = convert([allDay("2026-12-01", null)]);

    expect(events[0].ends_at).toBe("2026-12-02T00:00:00.000Z");
  });

  it("lasts one day when the end is the same day", () => {
    const { events } = convert([allDay("2026-12-01", "2026-12-01")]);

    expect(events[0].ends_at).toBe("2026-12-02T00:00:00.000Z");
  });

  it("is not moved by the profile zone", () => {
    const { events } = convert(
      [allDay("2026-12-01", "2026-12-02")],
      "Pacific/Auckland",
    );

    expect(events[0].starts_at).toBe("2026-12-01T00:00:00.000Z");
  });
});

describe("convertOccurrences ends (RF-18, RF-29)", () => {
  it("lasts zero when a timed event has no end (RF-18)", () => {
    const { events } = convert([timed("2026-11-02 10:00:00", null, madrid)]);

    expect(events[0].ends_at).toBe(events[0].starts_at);
  });

  it("leaves out an event that ends before it starts (RF-29)", () => {
    const { events, skipped } = convert([
      timed("2026-11-02 10:00:00", "2026-11-02 09:00:00", madrid),
      allDay("2026-12-05", "2026-12-01"),
      timed("2026-11-03 10:00:00", "2026-11-03 10:00:00", madrid),
    ]);

    expect(events).toHaveLength(1);
    expect(skipped).toBe(2);
  });
});

describe("convertOccurrences texts (RF-13..RF-15)", () => {
  const withTexts = (summary: string, description = "", location = "") =>
    convert([
      timed("2026-11-02 10:00:00", null, madrid, {
        summary,
        description,
        location,
      }),
    ]).events[0];

  it("converts title, description and location", () => {
    expect(withTexts("Álgebra", "Aula 3", "Facultad")).toMatchObject({
      title: "Álgebra",
      description: "Aula 3",
      location: "Facultad",
    });
  });

  it("gives an empty title the default (RF-14)", () => {
    expect(withTexts("").title).toBe("(Sin título)");
    expect(withTexts("   \n ").title).toBe("(Sin título)");
  });

  it("stores empty description and location as null", () => {
    expect(withTexts("x", "  ", "").description).toBeNull();
    expect(withTexts("x", "  ", "").location).toBeNull();
  });

  it("trims the texts", () => {
    expect(withTexts("  hola  ", " d ", " l ")).toMatchObject({
      title: "hola",
      description: "d",
      location: "l",
    });
  });

  it("cuts title, description and location to 100, 2000 and 200 characters (RF-15)", () => {
    const row = withTexts("t".repeat(150), "d".repeat(3000), "l".repeat(300));

    expect(Array.from(row.title)).toHaveLength(100);
    expect(Array.from(row.description ?? "")).toHaveLength(2000);
    expect(Array.from(row.location ?? "")).toHaveLength(200);
  });

  it("does not split an emoji when cutting", () => {
    const row = withTexts("a".repeat(99) + "😀😀");

    expect(row.title).toBe("a".repeat(99) + "😀");
  });

  it("removes characters Postgres rejects (plan D11)", () => {
    const row = withTexts("a\u0000b", "x\uD800y", "p\uDC00q");

    expect(row.title).toBe("ab");
    expect(row.description).toBe("xy");
    expect(row.location).toBe("pq");
  });

  it("gives rows exactly the shape import_calendar expects", () => {
    const { events } = convert([timed("2026-11-02 10:00:00", null, madrid)]);

    expect(Object.keys(events[0]).sort()).toEqual(
      [
        "all_day",
        "description",
        "ends_at",
        "location",
        "starts_at",
        "title",
      ].sort(),
    );
    expect(events[0].all_day).toBe(false);
  });
});
