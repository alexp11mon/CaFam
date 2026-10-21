import { describe, expect, it } from "vitest";
import {
  dayEvents,
  eventDayKeys,
  isBanner,
  layoutTimedDay,
  splitVisible,
  type LayoutEventInput,
} from "@/lib/calendar/layout";

const MADRID = "Europe/Madrid";
const NEW_YORK = "America/New_York";

// 2026-11-02 is winter time in Madrid (UTC+1).
function timed(id: string, startsAt: string, endsAt: string): LayoutEventInput {
  return { id, startsAt, endsAt, allDay: false };
}

function allDay(id: string, startsAt: string, endsAt: string) {
  return { id, startsAt, endsAt, allDay: true };
}

describe("eventDayKeys (RF-21, casos límite)", () => {
  it("returns a single day for a same-day event", () => {
    const event = timed("a", "2026-11-02T09:00:00Z", "2026-11-02T10:00:00Z");

    expect(eventDayKeys(event, MADRID)).toEqual(["2026-11-02"]);
  });

  it("includes both days of an event crossing midnight", () => {
    // 23:00 -> 02:00 in Madrid.
    const event = timed("a", "2026-11-02T22:00:00Z", "2026-11-03T01:00:00Z");

    expect(eventDayKeys(event, MADRID)).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("does not spill into the next day when it ends exactly at midnight", () => {
    // 09:00 -> 00:00 next day in Madrid.
    const event = timed("a", "2026-11-02T08:00:00Z", "2026-11-02T23:00:00Z");

    expect(eventDayKeys(event, MADRID)).toEqual(["2026-11-02"]);
  });

  it("keeps a zero-duration event on its day", () => {
    const event = timed("a", "2026-11-02T09:00:00Z", "2026-11-02T09:00:00Z");

    expect(eventDayKeys(event, MADRID)).toEqual(["2026-11-02"]);
  });

  it("lists every day of a multi-day timed event", () => {
    const event = timed("a", "2026-11-02T09:00:00Z", "2026-11-04T09:00:00Z");

    expect(eventDayKeys(event, MADRID)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
  });

  it("reads all-day events by UTC date, whatever the viewer's zone (plan D6)", () => {
    const single = allDay("a", "2026-11-02T00:00:00Z", "2026-11-03T00:00:00Z");
    const three = allDay("b", "2026-11-02T00:00:00Z", "2026-11-05T00:00:00Z");

    for (const tz of [MADRID, NEW_YORK]) {
      expect(eventDayKeys(single, tz)).toEqual(["2026-11-02"]);
      expect(eventDayKeys(three, tz)).toEqual([
        "2026-11-02",
        "2026-11-03",
        "2026-11-04",
      ]);
    }
  });

  it("accepts Postgres timestamps with a +00:00 offset", () => {
    const event = allDay(
      "a",
      "2026-11-02T00:00:00+00:00",
      "2026-11-03T00:00:00+00:00",
    );

    expect(eventDayKeys(event, MADRID)).toEqual(["2026-11-02"]);
  });
});

describe("isBanner (RF-35)", () => {
  it("is true for all-day events and events lasting a day or more over several days", () => {
    expect(
      isBanner(
        allDay("a", "2026-11-02T00:00:00Z", "2026-11-03T00:00:00Z"),
        MADRID,
      ),
    ).toBe(true);
    expect(
      isBanner(
        timed("b", "2026-11-02T09:00:00Z", "2026-11-04T09:00:00Z"),
        MADRID,
      ),
    ).toBe(true);
  });

  it("is false for timed events, even when they cross midnight", () => {
    expect(
      isBanner(
        timed("a", "2026-11-02T09:00:00Z", "2026-11-02T10:00:00Z"),
        MADRID,
      ),
    ).toBe(false);
    expect(
      isBanner(
        timed("b", "2026-11-02T22:00:00Z", "2026-11-03T01:00:00Z"),
        MADRID,
      ),
    ).toBe(false);
  });
});

describe("dayEvents (RF-35, RF-39)", () => {
  const events = [
    timed("late", "2026-11-02T15:00:00Z", "2026-11-02T16:00:00Z"),
    timed("early", "2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z"),
    allDay("birthday", "2026-11-02T00:00:00Z", "2026-11-03T00:00:00Z"),
    timed("other-day", "2026-11-03T08:00:00Z", "2026-11-03T09:00:00Z"),
  ];

  it("keeps only the events of that day: banners first, then by start time", () => {
    const result = dayEvents(events, "2026-11-02", MADRID);

    expect(result.map((item) => item.event.id)).toEqual([
      "birthday",
      "early",
      "late",
    ]);
    expect(result.map((item) => item.banner)).toEqual([true, false, false]);
  });

  it("returns an empty list for a day without events", () => {
    expect(dayEvents(events, "2026-12-25", MADRID)).toEqual([]);
  });
});

describe("splitVisible (RF-39)", () => {
  it("shows everything when it fits", () => {
    expect(splitVisible([1, 2, 3], 3)).toEqual({
      visible: [1, 2, 3],
      hidden: 0,
    });
  });

  it("counts the events that do not fit", () => {
    expect(splitVisible([1, 2, 3, 4, 5], 3)).toEqual({
      visible: [1, 2, 3],
      hidden: 2,
    });
  });
});

describe("layoutTimedDay (RF-40)", () => {
  const day = "2026-11-02";
  const at = (hhmm: string) => `2026-11-02T${hhmm}:00Z`; // UTC; Madrid is +1

  function layout(events: LayoutEventInput[]) {
    return layoutTimedDay(events, day, MADRID).map((item) => ({
      id: item.event.id,
      start: item.startMinute,
      end: item.endMinute,
      column: item.column,
      columns: item.columns,
    }));
  }

  it("places a lone event across the full width", () => {
    expect(layout([timed("a", at("08:00"), at("09:00"))])).toEqual([
      { id: "a", start: 540, end: 600, column: 0, columns: 1 },
    ]);
  });

  it("puts overlapping events side by side and reuses freed columns", () => {
    // 09:00-10:00, 09:30-10:30, 10:00-11:00 (local)
    const result = layout([
      timed("a", at("08:00"), at("09:00")),
      timed("b", at("08:30"), at("09:30")),
      timed("c", at("09:00"), at("10:00")),
    ]);

    expect(result).toEqual([
      { id: "a", start: 540, end: 600, column: 0, columns: 2 },
      { id: "b", start: 570, end: 630, column: 1, columns: 2 },
      { id: "c", start: 600, end: 660, column: 0, columns: 2 },
    ]);
  });

  it("does not treat events that only touch as overlapping", () => {
    const result = layout([
      timed("a", at("08:00"), at("09:00")),
      timed("b", at("09:00"), at("10:00")),
    ]);

    expect(result.map((item) => [item.column, item.columns])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("sizes separate groups of overlaps independently", () => {
    const result = layout([
      timed("a", at("08:00"), at("10:00")),
      timed("b", at("08:30"), at("09:00")),
      timed("c", at("12:00"), at("13:00")),
    ]);

    expect(result.find((item) => item.id === "c")).toMatchObject({
      column: 0,
      columns: 1,
    });
    expect(result.find((item) => item.id === "a")?.columns).toBe(2);
  });

  it("keeps zero-duration events visible and apart from each other", () => {
    const result = layout([
      timed("a", at("08:00"), at("08:00")),
      timed("b", at("08:00"), at("08:00")),
    ]);

    expect(result.map((item) => item.column).sort()).toEqual([0, 1]);
    expect(result.every((item) => item.columns === 2)).toBe(true);
  });

  it("splits an event crossing midnight into one segment per day", () => {
    const event = timed(
      "night",
      "2026-11-02T22:00:00Z",
      "2026-11-03T01:00:00Z",
    );

    const first = layoutTimedDay([event], "2026-11-02", MADRID);
    const second = layoutTimedDay([event], "2026-11-03", MADRID);

    expect([first[0]?.startMinute, first[0]?.endMinute]).toEqual([1380, 1440]);
    expect([second[0]?.startMinute, second[0]?.endMinute]).toEqual([0, 120]);
  });

  it("leaves banners out of the time grid", () => {
    const result = layout([
      allDay("trip", "2026-11-02T00:00:00Z", "2026-11-04T00:00:00Z"),
      timed("a", at("08:00"), at("09:00")),
    ]);

    expect(result.map((item) => item.id)).toEqual(["a"]);
  });
});
