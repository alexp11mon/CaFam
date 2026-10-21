import { describe, expect, it } from "vitest";
import {
  eventToFormDates,
  formatEventWhen,
  todayKey,
} from "@/lib/calendar/format";

describe("eventToFormDates (RF-22)", () => {
  it("returns local date and time for a timed event", () => {
    expect(
      eventToFormDates(
        {
          startsAt: "2026-11-02T22:00:00+00:00",
          endsAt: "2026-11-03T01:00:00+00:00",
          allDay: false,
        },
        "Europe/Madrid",
      ),
    ).toEqual({
      startDate: "2026-11-02",
      startTime: "23:00",
      endDate: "2026-11-03",
      endTime: "02:00",
    });
  });

  it("returns inclusive UTC dates and default times for an all-day event", () => {
    expect(
      eventToFormDates(
        {
          startsAt: "2026-12-24T00:00:00Z",
          endsAt: "2026-12-27T00:00:00Z",
          allDay: true,
        },
        "America/New_York",
      ),
    ).toEqual({
      startDate: "2026-12-24",
      startTime: "09:00",
      endDate: "2026-12-26",
      endTime: "10:00",
    });
  });
});

describe("formatEventWhen", () => {
  it("shows a single instant for a zero-duration event", () => {
    expect(
      formatEventWhen(
        {
          startsAt: "2026-11-02T07:00:00Z",
          endsAt: "2026-11-02T07:00:00Z",
          allDay: false,
        },
        "Europe/Madrid",
      ),
    ).toBe("lunes, 2 de noviembre de 2026, 08:00");
  });

  it("shows a single day for a one-day all-day event", () => {
    expect(
      formatEventWhen(
        {
          startsAt: "2026-12-24T00:00:00Z",
          endsAt: "2026-12-25T00:00:00Z",
          allDay: true,
        },
        "Europe/Madrid",
      ),
    ).toBe("jueves, 24 de diciembre de 2026");
  });
});

describe("todayKey", () => {
  it("gives the local day in the zone", () => {
    const instant = new Date("2026-10-24T22:30:00Z");

    expect(todayKey("Europe/Madrid", instant)).toBe("2026-10-25");
    expect(todayKey("America/New_York", instant)).toBe("2026-10-24");
  });
});
