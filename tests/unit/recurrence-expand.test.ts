// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  expandSeries,
  firstOccurrence,
  seriesBound,
  truncateBefore,
  type SeriesInput,
} from "@/lib/recurrence/expand";

const MADRID = "Europe/Madrid";

function timed(
  recurrence: string,
  startsAt = "2026-10-06T16:00:00Z", // Tuesday 18:00 in Madrid (summer time)
  endsAt = "2026-10-06T17:00:00Z",
): SeriesInput {
  return {
    startsAt,
    endsAt,
    allDay: false,
    recurrence,
    recurrenceTz: MADRID,
  };
}

function allDay(recurrence: string, start: string, days = 1): SeriesInput {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  return {
    startsAt: new Date(startMs).toISOString(),
    endsAt: new Date(startMs + days * 86_400_000).toISOString(),
    allDay: true,
    recurrence,
    recurrenceTz: null,
  };
}

const range = (from: string, to: string) =>
  [new Date(from), new Date(to)] as const;

describe("expandSeries", () => {
  it("keeps 18:00 wall-clock across both daylight saving changes (RF-12)", () => {
    const series = timed("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU");
    const october = expandSeries(series, ...range("2026-10-20", "2026-11-04"));
    expect(october.map((o) => o.startsAt)).toEqual([
      "2026-10-20T16:00:00.000Z", // CEST, UTC+2
      "2026-10-27T17:00:00.000Z", // CET, UTC+1
      "2026-11-03T17:00:00.000Z",
    ]);
    expect(october[1]!.endsAt).toBe("2026-10-27T18:00:00.000Z");

    const march = expandSeries(series, ...range("2027-03-23", "2027-04-01"));
    expect(march.map((o) => o.startsAt)).toEqual([
      "2027-03-23T17:00:00.000Z",
      "2027-03-30T16:00:00.000Z",
    ]);
  });

  it("skips months without day 31 (RF-13)", () => {
    const series = allDay(
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31",
      "2027-01-31",
    );
    const dates = expandSeries(
      series,
      ...range("2027-01-01", "2027-08-01"),
    ).map((o) => o.startsAt.slice(0, 10));
    expect(dates).toEqual([
      "2027-01-31",
      "2027-03-31",
      "2027-05-31",
      "2027-07-31",
    ]);
  });

  it("29 February only in leap years", () => {
    const series = allDay(
      "FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29",
      "2028-02-29",
    );
    const dates = expandSeries(
      series,
      ...range("2028-01-01", "2037-01-01"),
    ).map((o) => o.startsAt.slice(0, 10));
    expect(dates).toEqual(["2028-02-29", "2032-02-29", "2036-02-29"]);
  });

  it("the last Friday of each month", () => {
    const series = timed(
      "FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR",
      "2026-10-30T09:00:00Z",
      "2026-10-30T10:00:00Z",
    );
    const dates = expandSeries(
      series,
      ...range("2026-10-01", "2027-01-01"),
    ).map((o) => o.startsAt.slice(0, 10));
    expect(dates).toEqual(["2026-10-30", "2026-11-27", "2026-12-25"]);
  });

  it("all-day series keep their UTC date, without zone (RF-14)", () => {
    const series = allDay("FREQ=WEEKLY;INTERVAL=1;BYDAY=SU", "2026-10-25");
    const [first, second] = expandSeries(
      series,
      ...range("2026-10-20", "2026-11-03"),
    );
    expect(first).toEqual({
      originalStart: "2026-10-25T00:00:00.000Z",
      startsAt: "2026-10-25T00:00:00.000Z",
      endsAt: "2026-10-26T00:00:00.000Z",
    });
    expect(second!.startsAt).toBe("2026-11-01T00:00:00.000Z");
  });

  it("overlapping multi-day occurrences all show", () => {
    const series = allDay("FREQ=DAILY;INTERVAL=2", "2026-11-01", 3);
    // 1 Nov ends on 4 Nov 00:00, which counts as touching (ends_at >= from),
    // like getEventsInRange; 5 Nov starts at the end of the range.
    const result = expandSeries(series, ...range("2026-11-04", "2026-11-05"));
    expect(result.map((o) => o.startsAt.slice(0, 10))).toEqual([
      "2026-11-01",
      "2026-11-03",
    ]);
    const wider = expandSeries(series, ...range("2026-11-04", "2026-11-06"));
    expect(wider.map((o) => o.startsAt.slice(0, 10))).toEqual([
      "2026-11-01",
      "2026-11-03",
      "2026-11-05",
    ]);
  });

  it("a series that started before the range gives only what is inside", () => {
    const series = timed("FREQ=DAILY;INTERVAL=1");
    const result = expandSeries(series, ...range("2026-12-10", "2026-12-12"));
    expect(result.map((o) => o.startsAt)).toEqual([
      "2026-12-10T17:00:00.000Z",
      "2026-12-11T17:00:00.000Z",
    ]);
  });

  it("respects COUNT and an included UNTIL", () => {
    const counted = timed("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=3");
    expect(
      expandSeries(counted, ...range("2026-01-01", "2028-01-01")),
    ).toHaveLength(3);

    const until = timed(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;UNTIL=20261020T235959",
    );
    expect(
      expandSeries(until, ...range("2026-01-01", "2028-01-01")).map((o) =>
        o.startsAt.slice(0, 10),
      ),
    ).toEqual(["2026-10-06", "2026-10-13", "2026-10-20"]);
  });

  it("skips occurrences with an exception or an exdate", () => {
    const series = timed("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU");
    const skip = new Set([Date.parse("2026-10-13T16:00:00Z")]);
    expect(
      expandSeries(series, ...range("2026-10-01", "2026-10-21"), skip).map(
        (o) => o.startsAt.slice(0, 10),
      ),
    ).toEqual(["2026-10-06", "2026-10-20"]);
  });

  it("a start that does not match the rule is not an occurrence (casos límite)", () => {
    // Wednesday 7 October with "every Monday".
    const series = timed(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      "2026-10-07T16:00:00Z",
      "2026-10-07T17:00:00Z",
    );
    expect(
      expandSeries(series, ...range("2026-10-01", "2026-10-20")).map((o) =>
        o.startsAt.slice(0, 10),
      ),
    ).toEqual(["2026-10-12", "2026-10-19"]);
  });

  it("fast-forwarding a 10-year-old daily series changes nothing (plan D6)", () => {
    const series = timed(
      "FREQ=DAILY;INTERVAL=3",
      "2016-10-04T16:00:00Z",
      "2016-10-04T17:00:00Z",
    );
    const slow = expandSeries(
      series,
      ...range("2026-10-01", "2026-11-01"),
      new Set(),
      {
        fastForward: false,
      },
    );
    const fast = expandSeries(series, ...range("2026-10-01", "2026-11-01"));
    expect(fast).toEqual(slow);
    expect(fast.length).toBeGreaterThan(9);
  });

  it("fast-forwards weekly series on several days too (plan D6)", () => {
    const series = timed(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH",
      "2018-01-01T08:00:00Z",
      "2018-01-01T09:00:00Z",
    );
    const slow = expandSeries(
      series,
      ...range("2026-10-01", "2026-12-01"),
      new Set(),
      {
        fastForward: false,
      },
    );
    expect(expandSeries(series, ...range("2026-10-01", "2026-12-01"))).toEqual(
      slow,
    );
  });

  it("ignores an unreadable rule instead of throwing (plan R3)", () => {
    expect(
      expandSeries(timed("FREQ=HOURLY"), ...range("2026-01-01", "2027-01-01")),
    ).toEqual([]);
  });
});

describe("firstOccurrence, seriesBound and truncateBefore", () => {
  it("the first occurrence of 'every Monday' from a Wednesday is next Monday", () => {
    const series = timed(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      "2026-10-07T16:00:00Z",
      "2026-10-07T17:30:00Z",
    );
    expect(firstOccurrence(series)).toEqual({
      originalStart: "2026-10-12T16:00:00.000Z",
      startsAt: "2026-10-12T16:00:00.000Z",
      endsAt: "2026-10-12T17:30:00.000Z",
    });
  });

  it("has no first occurrence when the end comes before (RF-8)", () => {
    const series = timed(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20261011T235959",
      "2026-10-07T16:00:00Z",
    );
    expect(firstOccurrence(series)).toBeNull();
    expect(
      firstOccurrence(
        allDay(
          "FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29;COUNT=1",
          "2027-03-01",
        ),
      ),
    ).toEqual(
      expect.objectContaining({ startsAt: "2028-02-29T00:00:00.000Z" }),
    );
  });

  it("seriesBound is the end of the last occurrence, or null without end", () => {
    expect(seriesBound(timed("FREQ=DAILY;INTERVAL=1"))).toBeNull();
    expect(seriesBound(timed("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=4"))).toBe(
      "2026-10-27T18:00:00.000Z",
    );
    expect(
      seriesBound(
        timed("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;UNTIL=20261020T235959"),
      ),
    ).toBe("2026-10-20T17:00:00.000Z");
  });

  it("truncateBefore with UNTIL ends the day before", () => {
    const series = timed("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU");
    expect(truncateBefore(series, "2026-10-27T17:00:00.000Z")).toEqual({
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;UNTIL=20261026T235959",
      until: "2026-10-20T17:00:00.000Z",
      remaining: { kind: "never" },
    });
  });

  it("truncateBefore with COUNT splits the count", () => {
    const series = timed("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=10");
    expect(truncateBefore(series, "2026-10-20T16:00:00.000Z")).toEqual({
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=2",
      until: "2026-10-13T17:00:00.000Z",
      remaining: { kind: "count", count: 8 },
    });
  });

  it("truncateBefore the first occurrence leaves nothing", () => {
    const series = timed("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU");
    expect(
      truncateBefore(series, "2026-10-06T16:00:00.000Z").recurrence,
    ).toBeNull();
  });
});
