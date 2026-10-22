import { describe, expect, it } from "vitest";
import { buildAgenda } from "@/lib/calendar/agenda";
import type { LayoutEventInput } from "@/lib/calendar/layout";
import { getVisibleRange } from "@/lib/calendar/ranges";

// Spec 005, T3: the days of the agenda view as pure data
// (RF-31, RF-33, RF-34, RF-36, RF-39, RF-43; plan agenda-layout).
const MADRID = "Europe/Madrid";
const TODAY = "2026-11-02";

function timed(id: string, startsAt: string, endsAt: string): LayoutEventInput {
  return { id, startsAt, endsAt, allDay: false };
}

function allDay(id: string, startsAt: string, endsAt: string) {
  return { id, startsAt, endsAt, allDay: true };
}

function agenda(
  events: LayoutEventInput[],
  options: { start?: string; now?: Date } = {},
) {
  const { days } = getVisibleRange("agenda", options.start ?? TODAY, MADRID);
  return buildAgenda({
    days,
    events,
    timeZone: MADRID,
    today: TODAY,
    now: options.now,
  });
}

describe("buildAgenda", () => {
  it("returns the 14 days, empty ones included (RF-31)", () => {
    const result = agenda([]);

    expect(result).toHaveLength(14);
    expect(result.every((day) => day.entries.length === 0)).toBe(true);
    expect(result[0]!.key).toBe(TODAY);
    expect(result[13]!.key).toBe("2026-11-15");
  });

  it("names each day for the big number and for screen readers (RF-32, RF-33)", () => {
    const [first, second] = agenda([]);

    expect(first).toMatchObject({
      number: "02",
      weekday: "lun",
      label: "lunes, 2 de noviembre de 2026",
      isToday: true,
    });
    expect(second).toMatchObject({
      number: "03",
      weekday: "mar",
      isToday: false,
    });
  });

  it("puts all-day events first, then by start time (RF-34)", () => {
    const [day] = agenda([
      timed("late", "2026-11-02T17:00:00Z", "2026-11-02T18:00:00Z"),
      timed("early", "2026-11-02T08:00:00Z", "2026-11-02T09:30:00Z"),
      allDay("birthday", "2026-11-02T00:00:00Z", "2026-11-03T00:00:00Z"),
    ]);

    expect(day!.entries.map((entry) => entry.event.id)).toEqual([
      "birthday",
      "early",
      "late",
    ]);
    expect(day!.entries.map(({ start, end }) => [start, end])).toEqual([
      ["Todo el día", null],
      ["09:00", "10:30"],
      ["18:00", "19:00"],
    ]);
  });

  it("repeats an event of several days on every day it covers (RF-36)", () => {
    const result = agenda([
      allDay("trip", "2026-11-03T00:00:00Z", "2026-11-06T00:00:00Z"),
    ]);

    expect(
      result.filter((day) => day.entries.length > 0).map((day) => day.key),
    ).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
  });

  it("says where an overnight event comes from and where it ends (casos límite)", () => {
    // 23:00 on the 2nd to 01:00 on the 3rd in Madrid.
    const [first, second] = agenda([
      timed("party", "2026-11-02T22:00:00Z", "2026-11-03T00:00:00Z"),
    ]);

    expect(first!.entries[0]).toMatchObject({
      start: "23:00",
      end: "Hasta el 3 nov a las 01:00",
    });
    expect(second!.entries[0]).toMatchObject({
      start: "Desde el 2 nov a las 23:00",
      end: "01:00",
    });
  });

  it("shows a zero-length event with its start only", () => {
    const [day] = agenda([
      timed("call", "2026-11-02T10:00:00Z", "2026-11-02T10:00:00Z"),
    ]);

    expect(day!.entries[0]).toMatchObject({ start: "11:00", end: null });
  });

  it("keeps local times across the daylight saving change (casos límite)", () => {
    // Madrid leaves summer time on 2026-10-25: 10:00 local is 08:00 UTC before
    // and 09:00 UTC after.
    const result = agenda(
      [
        timed("before", "2026-10-24T08:00:00Z", "2026-10-24T09:00:00Z"),
        timed("after", "2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z"),
      ],
      { start: "2026-10-24" },
    );

    expect(result[0]!.entries[0]!.start).toBe("10:00");
    expect(result[2]!.entries[0]!.start).toBe("10:00");
  });

  it("places the now line between started and upcoming events, only today (RF-39)", () => {
    const events = [
      allDay("birthday", "2026-11-02T00:00:00Z", "2026-11-03T00:00:00Z"),
      timed("done", "2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z"),
      timed("ongoing", "2026-11-02T10:00:00Z", "2026-11-02T12:00:00Z"),
      timed("next", "2026-11-02T15:00:00Z", "2026-11-02T16:00:00Z"),
      timed("tomorrow", "2026-11-03T08:00:00Z", "2026-11-03T09:00:00Z"),
    ];

    const result = agenda(events, { now: new Date("2026-11-02T11:00:00Z") });

    expect(result[0]!.nowIndex).toBe(3);
    expect(result[1]!.nowIndex).toBeNull();
  });

  it("puts the now line at the end when everything has started, and nowhere without a clock", () => {
    const events = [timed("a", "2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z")];

    expect(
      agenda(events, { now: new Date("2026-11-02T20:00:00Z") })[0]!.nowIndex,
    ).toBe(1);
    expect(agenda(events)[0]!.nowIndex).toBeNull();
  });

  it("has no now line when today is outside the range", () => {
    const result = agenda([], {
      start: "2026-12-01",
      now: new Date("2026-11-02T11:00:00Z"),
    });

    expect(result.every((day) => day.nowIndex === null && !day.isToday)).toBe(
      true,
    );
  });
});
