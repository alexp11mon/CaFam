import { describe, expect, it } from "vitest";
import {
  dayBounds,
  parsePeriod,
  quotaDayStart,
  dateContext,
  minutesOf,
} from "@/lib/assistant/dates";
import { busyFromEvent, freeSlots } from "@/lib/assistant/free-slots";
import {
  DAILY_QUESTIONS,
  DEFAULT_RANGES,
  MAX_FREE_DAYS,
  MAX_LISTED_EVENTS,
  QUESTION_MAX,
} from "@/lib/assistant/limits";

// Spec 015, T3: dates in the profile's zone and free time (RF-7, RF-14,
// RF-17, RF-17b, RF-18, RF-19, RF-24; plan D8).
const TZ = "Europe/Madrid";
const iso = (date: Date) => date.toISOString();

describe("limits", () => {
  it("match the spec", () => {
    expect(QUESTION_MAX).toBe(500);
    expect(DAILY_QUESTIONS).toBe(30);
    expect(MAX_FREE_DAYS).toBe(31);
    expect(MAX_LISTED_EVENTS).toBe(50);
    expect(DEFAULT_RANGES).toEqual([
      { start: "08:00", end: "14:00" },
      { start: "16:00", end: "21:00" },
      { start: "21:00", end: "24:00" },
    ]);
  });
});

describe("dates", () => {
  it("gives the bounds of a local day, also on the DST change", () => {
    const day = dayBounds("2026-11-02", TZ);
    expect(iso(day.start)).toBe("2026-11-01T23:00:00.000Z");
    expect(iso(day.end)).toBe("2026-11-02T23:00:00.000Z");
    // 25 hours on the last Sunday of October.
    const long = dayBounds("2026-10-25", TZ);
    expect(long.end.getTime() - long.start.getTime()).toBe(25 * 3_600_000);
  });

  it("starts the quota day at midnight in the profile's zone", () => {
    expect(iso(quotaDayStart(new Date("2026-11-02T23:30:00Z"), TZ))).toBe(
      "2026-11-02T23:00:00.000Z",
    );
    expect(iso(quotaDayStart(new Date("2026-11-02T10:00:00Z"), TZ))).toBe(
      "2026-11-01T23:00:00.000Z",
    );
  });

  it("parses a period and rejects impossible or reversed dates", () => {
    const ok = parsePeriod("2026-11-09", "2026-11-15", TZ, 31);
    expect(ok).toMatchObject({ status: "ok" });
    if (ok.status === "ok") {
      expect(ok.days).toHaveLength(7);
      expect(iso(ok.from)).toBe("2026-11-08T23:00:00.000Z");
      expect(iso(ok.to)).toBe("2026-11-15T23:00:00.000Z");
    }
    expect(parsePeriod("2026-02-31", "2026-03-01", TZ, 31)).toEqual({
      status: "invalid_date",
    });
    expect(parsePeriod("2026-11-15", "2026-11-09", TZ, 31)).toEqual({
      status: "invalid_date",
    });
    expect(parsePeriod("2026-11-01", "2026-12-02", TZ, 31)).toEqual({
      status: "too_long",
    });
    expect(parsePeriod("2026-11-01", "2026-12-02", TZ, 31).status).toBe(
      "too_long",
    );
    expect(parsePeriod("2026-11-01", "2026-12-02", TZ, 62).status).toBe("ok");
    // RF-24: exactly 31 days is allowed.
    expect(parsePeriod("2026-11-01", "2026-12-01", TZ, 31).status).toBe("ok");
  });

  it("describes today, the next 14 days and the relative weeks", () => {
    // Monday 2 November 2026, 10:00 in Madrid.
    const context = dateContext(new Date("2026-11-02T09:00:00Z"), TZ);
    expect(context.today).toBe("2026-11-02");
    expect(context.days).toHaveLength(14);
    expect(context.days[5]).toEqual({ date: "2026-11-07", weekday: "sábado" });
    expect(context.thisWeek).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(context.nextWeek).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(context.weekend).toEqual({ from: "2026-11-07", to: "2026-11-08" });
    // On a Sunday the weekend is today.
    const sunday = dateContext(new Date("2026-11-08T09:00:00Z"), TZ);
    expect(sunday.weekend).toEqual({ from: "2026-11-07", to: "2026-11-08" });
  });

  it("reads HH:MM, with 24:00 as the end of the day", () => {
    expect(minutesOf("08:30")).toBe(510);
    expect(minutesOf("24:00")).toBe(1440);
    expect(minutesOf("25:00")).toBeNull();
    expect(minutesOf("8h")).toBeNull();
  });
});

describe("busyFromEvent (RF-18)", () => {
  it("keeps timed events as they are", () => {
    expect(
      busyFromEvent(
        {
          startsAt: "2026-11-09T16:00:00Z",
          endsAt: "2026-11-09T17:00:00Z",
          allDay: false,
        },
        TZ,
      ),
    ).toEqual({
      start: Date.parse("2026-11-09T16:00:00Z"),
      end: Date.parse("2026-11-09T17:00:00Z"),
    });
  });

  it("makes all-day events fill their local days by UTC date", () => {
    const busy = busyFromEvent(
      {
        startsAt: "2026-11-09T00:00:00Z",
        endsAt: "2026-11-11T00:00:00Z",
        allDay: true,
      },
      TZ,
    );
    expect(new Date(busy.start).toISOString()).toBe("2026-11-08T23:00:00.000Z");
    expect(new Date(busy.end).toISOString()).toBe("2026-11-10T23:00:00.000Z");
  });
});

describe("freeSlots (RF-14, RF-17, RF-17b, RF-19, D8)", () => {
  const days = ["2026-11-09", "2026-11-10"];
  const local = (day: string, time: string) => {
    const [h, m] = time.split(":").map(Number);
    return (
      dayBounds(day, TZ).start.getTime() + ((h ?? 0) * 60 + (m ?? 0)) * 60_000
    );
  };
  const busy = (day: string, from: string, to: string) => ({
    start: local(day, from),
    end: local(day, to),
  });

  it("returns the default ranges when nothing is busy", () => {
    expect(freeSlots([], ["2026-11-09"], DEFAULT_RANGES, TZ)).toEqual([
      {
        date: "2026-11-09",
        free: [
          { start: "08:00", end: "14:00" },
          { start: "16:00", end: "21:00" },
          { start: "21:00", end: "24:00" },
        ],
      },
    ]);
  });

  it("splits a range around an event and drops gaps under 30 minutes", () => {
    const result = freeSlots(
      [
        busy("2026-11-09", "17:00", "18:00"),
        busy("2026-11-09", "18:20", "20:00"),
      ],
      ["2026-11-09"],
      [{ start: "16:00", end: "21:00" }],
      TZ,
    );
    expect(result[0]?.free).toEqual([
      { start: "16:00", end: "17:00" },
      { start: "20:00", end: "21:00" },
    ]);
  });

  it("uses the hours asked for instead of the defaults", () => {
    const result = freeSlots(
      [],
      ["2026-11-09"],
      [{ start: "17:00", end: "19:30" }],
      TZ,
    );
    expect(result[0]?.free).toEqual([{ start: "17:00", end: "19:30" }]);
  });

  it("crosses everyone's busy times and keeps days with no gap", () => {
    const result = freeSlots(
      [
        busy("2026-11-09", "16:00", "18:00"), // me
        busy("2026-11-09", "19:00", "21:00"), // Luis
        busyFromEvent(
          {
            startsAt: "2026-11-10T00:00:00Z",
            endsAt: "2026-11-11T00:00:00Z",
            allDay: true,
          },
          TZ,
        ),
      ],
      days,
      [{ start: "16:00", end: "21:00" }],
      TZ,
    );
    expect(result).toEqual([
      { date: "2026-11-09", free: [{ start: "18:00", end: "19:00" }] },
      { date: "2026-11-10", free: [] },
    ]);
  });

  it("handles events that cross midnight", () => {
    const result = freeSlots(
      [
        {
          start: local("2026-11-09", "22:00"),
          end: local("2026-11-10", "09:00"),
        },
      ],
      days,
      [
        { start: "08:00", end: "14:00" },
        { start: "21:00", end: "24:00" },
      ],
      TZ,
    );
    expect(result).toEqual([
      {
        date: "2026-11-09",
        free: [
          { start: "08:00", end: "14:00" },
          { start: "21:00", end: "22:00" },
        ],
      },
      {
        date: "2026-11-10",
        free: [
          { start: "09:00", end: "14:00" },
          { start: "21:00", end: "24:00" },
        ],
      },
    ]);
  });

  it("shows the gaps in the asker's zone", () => {
    const result = freeSlots(
      [
        {
          start: Date.parse("2026-11-09T16:00:00Z"),
          end: Date.parse("2026-11-09T17:00:00Z"),
        },
      ],
      ["2026-11-09"],
      [{ start: "16:00", end: "21:00" }],
      "America/New_York",
    );
    expect(result[0]?.free).toEqual([{ start: "16:00", end: "21:00" }]);
    const madrid = freeSlots(
      [
        {
          start: Date.parse("2026-11-09T16:00:00Z"),
          end: Date.parse("2026-11-09T17:00:00Z"),
        },
      ],
      ["2026-11-09"],
      [{ start: "16:00", end: "21:00" }],
      TZ,
    );
    expect(madrid[0]?.free).toEqual([
      { start: "16:00", end: "17:00" },
      { start: "18:00", end: "21:00" },
    ]);
  });
});
