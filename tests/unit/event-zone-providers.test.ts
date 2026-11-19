// @vitest-environment node
import { describe, expect, it } from "vitest";
import { convertGoogleEvents } from "@/lib/sync/google-events";
import {
  toGoogleEvent,
  toGooglePatch,
  type WritableEvent,
} from "@/lib/sync/google-payload";
import { expandObject, newEventIcs, patchIcs } from "@/lib/sync/icloud-ics";
import { writeIcs, type IcsRow } from "@/lib/ics/write-ics";
import { parseIcs } from "@/lib/ics/parse-ics";
import { convertOccurrences } from "@/lib/ics/convert-events";

// Spec 045, T5: the own zone travels to Google, iCloud and .ics files and
// comes back from them (RF-9, RF-10, RF-11).
const NY = "America/New_York";

const EVENT: WritableEvent = {
  title: "Vuelo",
  description: null,
  location: null,
  // 18:00–20:00 in New York (EST, −5).
  starts_at: "2026-11-20T23:00:00.000Z",
  ends_at: "2026-11-21T01:00:00.000Z",
  all_day: false,
  start_tz: NY,
  end_tz: NY,
};

const WINDOW = {
  from: new Date("2026-10-01T00:00:00Z"),
  to: new Date("2027-10-01T00:00:00Z"),
};

describe("Google", () => {
  it("sends the own zone with the times", () => {
    const body = toGoogleEvent(EVENT) as {
      start: Record<string, unknown>;
      end: Record<string, unknown>;
    };
    expect(body.start).toMatchObject({ timeZone: NY });
    expect(body.end).toMatchObject({ timeZone: NY });
  });

  it("sends no zone without one, and none on all-day events", () => {
    const plain = { ...EVENT, start_tz: null, end_tz: null };
    expect(JSON.stringify(toGoogleEvent(plain))).not.toContain("timeZone");
    const day = { ...EVENT, all_day: true };
    expect(JSON.stringify(toGoogleEvent(day))).not.toContain("timeZone");
  });

  it("a change without zones keeps the event's (RF-11)", () => {
    const moved = { ...EVENT, start_tz: undefined, end_tz: undefined };
    moved.starts_at = "2026-11-21T00:00:00.000Z";
    moved.ends_at = "2026-11-21T02:00:00.000Z";
    const patch = toGooglePatch(EVENT, moved) as {
      start: Record<string, unknown>;
    };
    expect(patch.start).toMatchObject({ timeZone: NY });
  });

  it("a change of only the zone is sent", () => {
    const patch = toGooglePatch(EVENT, {
      ...EVENT,
      start_tz: null,
      end_tz: null,
    });
    expect(patch).toHaveProperty("start");
    expect(JSON.stringify(patch)).not.toContain("timeZone");
  });

  it("reads Google's zone into start_tz and end_tz", () => {
    const { events } = convertGoogleEvents([
      {
        id: "g1",
        summary: "Vuelo",
        start: { dateTime: "2026-11-20T18:00:00-05:00", timeZone: NY },
        end: { dateTime: "2026-11-20T20:00:00-05:00", timeZone: "Bogus/Zone" },
      },
      {
        id: "g2",
        start: { date: "2026-11-20", timeZone: NY },
        end: { date: "2026-11-21", timeZone: NY },
      },
    ]);
    expect(events[0]).toMatchObject({ start_tz: NY, end_tz: NY });
    expect(events[1]).toMatchObject({ start_tz: null, end_tz: null });
  });
});

describe("iCloud", () => {
  it("writes the wall clock with TZID and its VTIMEZONE", () => {
    const ics = newEventIcs("u1", EVENT);
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261120T180000");
    expect(ics).toContain("DTEND;TZID=America/New_York:20261120T200000");
    expect(ics.indexOf("BEGIN:VTIMEZONE")).toBeLessThan(
      ics.indexOf("BEGIN:VEVENT"),
    );
    const [row] = expandObject("/a.ics", ics, WINDOW).events;
    expect(row).toMatchObject({
      starts_at: EVENT.starts_at,
      ends_at: EVENT.ends_at,
      start_tz: NY,
      end_tz: NY,
    });
  });

  it("a move without zones keeps the TZID (RF-11)", () => {
    const ics = newEventIcs("u1", EVENT);
    const moved = {
      ...EVENT,
      start_tz: undefined,
      end_tz: undefined,
      starts_at: "2026-11-21T00:00:00.000Z",
      ends_at: "2026-11-21T02:00:00.000Z",
    };
    const patched = patchIcs(ics, null, EVENT, moved);
    expect(patched).toContain("DTSTART;TZID=America/New_York:20261120T190000");
  });

  it("dropping the zone writes UTC", () => {
    const ics = newEventIcs("u1", EVENT);
    const patched = patchIcs(ics, null, EVENT, {
      ...EVENT,
      start_tz: null,
      end_tz: null,
    });
    expect(patched).toContain("DTSTART:20261120T230000Z");
  });
});

describe(".ics files", () => {
  const row: IcsRow = {
    id: "a1",
    title: "Vuelo",
    description: null,
    location: null,
    starts_at: EVENT.starts_at,
    ends_at: EVENT.ends_at,
    all_day: false,
    recurrence: null,
    recurrence_tz: null,
    exdates: null,
    series_id: null,
    original_start: null,
    created_at: "2026-11-01T08:00:00Z",
    updated_at: "2026-11-02T09:30:00Z",
    start_tz: NY,
    end_tz: NY,
  };

  it("exports a single event in its zone and reads it back", () => {
    const text = writeIcs({ name: "C", rows: [row], now: new Date() });
    expect(text).toContain("DTSTART;TZID=America/New_York:20261120T180000");
    expect(text).toContain("BEGIN:VTIMEZONE");
    const parsed = parseIcs(text, {
      today: { year: 2026, month: 11, day: 19 },
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const { events } = convertOccurrences(parsed.occurrences, "Europe/Madrid");
    expect(events[0]).toMatchObject({
      starts_at: EVENT.starts_at,
      start_tz: NY,
      end_tz: NY,
    });
  });
});
