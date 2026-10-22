import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  nextEventsWindow,
  pickNextEvent,
} from "@/lib/calendar/next-event";

// Spec 005, T4: which event the "Próximo evento" block shows and how much is
// left (RF-45, RF-46, RF-48, RF-49; plan D12).
const NOW = new Date("2026-11-02T10:00:00Z");
const VISIBLE = new Set(["home", "work"]);

function event(
  id: string,
  startsAt: string,
  options: { endsAt?: string; allDay?: boolean; calendarId?: string } = {},
) {
  return {
    id,
    startsAt,
    endsAt: options.endsAt ?? startsAt,
    allDay: options.allDay ?? false,
    calendarId: options.calendarId ?? "home",
  };
}

describe("pickNextEvent", () => {
  it("returns the first timed event that has not started (RF-45)", () => {
    const events = [
      event("later", "2026-11-02T15:00:00Z"),
      event("soon", "2026-11-02T10:30:00Z"),
    ];

    expect(pickNextEvent(events, NOW, VISIBLE)?.id).toBe("soon");
  });

  it("skips all-day events and events already running (RF-45, casos límite)", () => {
    const events = [
      event("birthday", "2026-11-03T00:00:00Z", {
        endsAt: "2026-11-04T00:00:00Z",
        allDay: true,
      }),
      event("running", "2026-11-02T09:00:00Z", {
        endsAt: "2026-11-02T11:00:00Z",
      }),
      event("starting-now", "2026-11-02T10:00:00Z"),
      event("next", "2026-11-02T12:00:00Z"),
    ];

    expect(pickNextEvent(events, NOW, VISIBLE)?.id).toBe("next");
  });

  it("only looks 24 hours ahead (RF-45)", () => {
    expect(
      pickNextEvent([event("tomorrow", "2026-11-03T10:00:00Z")], NOW, VISIBLE)
        ?.id,
    ).toBe("tomorrow");
    expect(
      pickNextEvent([event("too-far", "2026-11-03T10:00:01Z")], NOW, VISIBLE),
    ).toBeNull();
  });

  it("ignores hidden calendars (RF-45)", () => {
    const events = [
      event("hidden", "2026-11-02T10:30:00Z", { calendarId: "gym" }),
      event("shown", "2026-11-02T11:00:00Z", { calendarId: "work" }),
    ];

    expect(pickNextEvent(events, NOW, VISIBLE)?.id).toBe("shown");
  });

  it("moves to the following event once the first one starts (RF-48)", () => {
    const events = [
      event("first", "2026-11-02T10:30:00Z"),
      event("second", "2026-11-02T11:00:00Z"),
    ];

    expect(
      pickNextEvent(events, new Date("2026-11-02T10:30:00Z"), VISIBLE)?.id,
    ).toBe("second");
  });

  it("returns null when there is nothing (RF-49)", () => {
    expect(pickNextEvent([], NOW, VISIBLE)).toBeNull();
  });
});

describe("formatCountdown (RF-46)", () => {
  const MINUTE = 60_000;

  it.each([
    [30_000, "en menos de 1 min"],
    [MINUTE, "en 1 min"],
    [25 * MINUTE + 30_000, "en 25 min"],
    [60 * MINUTE, "en 1 h"],
    [190 * MINUTE, "en 3 h 10 min"],
    [24 * 60 * MINUTE, "en 24 h"],
  ])("%i ms → %s", (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});

describe("nextEventsWindow (plan D12)", () => {
  it("reads 48 hours from now and remembers when", () => {
    const now = Date.parse("2026-11-02T10:00:00Z");

    expect(nextEventsWindow(now)).toEqual({
      from: new Date("2026-11-02T10:00:00Z"),
      to: new Date("2026-11-04T10:00:00Z"),
      loadedAt: now,
    });
  });
});
