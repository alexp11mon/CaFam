import { describe, expect, it } from "vitest";
import { parseNewEventQuery } from "@/lib/calendar/new-event-query";

// Spec 008, T2: what the new-event route reads from its URL (RF-10, RF-39).
const CALENDARS = ["cal-a", "cal-b"];
const TODAY = "2026-10-23";

describe("parseNewEventQuery", () => {
  it("falls back to today, the first editable calendar and 09:00–10:00", () => {
    expect(parseNewEventQuery({}, CALENDARS, TODAY)).toEqual({
      calendarId: "cal-a",
      date: TODAY,
      startTime: "09:00",
      endTime: "10:00",
      allDay: false,
      title: "",
    });
  });

  it("uses every valid value of the URL", () => {
    expect(
      parseNewEventQuery(
        {
          calendar: "cal-b",
          date: "2026-10-27",
          start: "16:00",
          end: "17:30",
          title: "Cena",
        },
        CALENDARS,
        TODAY,
      ),
    ).toEqual({
      calendarId: "cal-b",
      date: "2026-10-27",
      startTime: "16:00",
      endTime: "17:30",
      allDay: false,
      title: "Cena",
    });
  });

  it("reads an all-day event", () => {
    expect(parseNewEventQuery({ allDay: "1" }, CALENDARS, TODAY).allDay).toBe(
      true,
    );
  });

  it("ignores a calendar the user cannot write to and a wrong date", () => {
    const parsed = parseNewEventQuery(
      { calendar: "someone-else", date: "2026-02-31" },
      CALENDARS,
      TODAY,
    );
    expect(parsed.calendarId).toBe("cal-a");
    expect(parsed.date).toBe(TODAY);
  });

  it("ignores wrong times and keeps one hour after a valid start", () => {
    expect(
      parseNewEventQuery({ start: "25:00", end: "x" }, CALENDARS, TODAY),
    ).toMatchObject({ startTime: "09:00", endTime: "10:00" });
    expect(
      parseNewEventQuery({ start: "16:30" }, CALENDARS, TODAY),
    ).toMatchObject({ startTime: "16:30", endTime: "17:30" });
  });

  it("does not let the end fall before the start nor past the day", () => {
    expect(
      parseNewEventQuery({ start: "16:00", end: "15:00" }, CALENDARS, TODAY),
    ).toMatchObject({ startTime: "16:00", endTime: "17:00" });
    expect(
      parseNewEventQuery({ start: "23:30" }, CALENDARS, TODAY),
    ).toMatchObject({ startTime: "23:30", endTime: "23:59" });
  });

  it("keeps a title of up to 100 characters and drops a longer one", () => {
    expect(
      parseNewEventQuery({ title: "a".repeat(100) }, CALENDARS, TODAY).title,
    ).toHaveLength(100);
    expect(
      parseNewEventQuery({ title: "a".repeat(101) }, CALENDARS, TODAY).title,
    ).toBe("");
  });

  it("ignores repeated parameters", () => {
    expect(
      parseNewEventQuery({ title: ["a", "b"] }, CALENDARS, TODAY).title,
    ).toBe("");
  });
});

describe("parseNewEventQuery: duplicating (spec 008 RF-35)", () => {
  it("passes on a valid event id to copy from", () => {
    const id = "5b8f6c2e-3f0a-4d8e-9a51-2a8f1d7c9e10";
    expect(parseNewEventQuery({ from: id }, CALENDARS, TODAY).from).toBe(id);
    expect(
      parseNewEventQuery({ from: "nope" }, CALENDARS, TODAY).from,
    ).toBeUndefined();
  });
});
