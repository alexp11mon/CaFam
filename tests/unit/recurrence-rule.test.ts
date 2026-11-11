import { describe, expect, it } from "vitest";
import {
  fromRRule,
  toRRule,
  type RecurrenceRule,
  shiftRule,
} from "@/lib/recurrence/rule";

const NEVER = { kind: "never" } as const;

const ROUND_TRIPS: [RecurrenceRule, boolean, string][] = [
  [{ freq: "daily", interval: 1, end: NEVER }, false, "FREQ=DAILY;INTERVAL=1"],
  [
    { freq: "daily", interval: 3, end: { kind: "count", count: 10 } },
    false,
    "FREQ=DAILY;INTERVAL=3;COUNT=10",
  ],
  [
    { freq: "weekly", interval: 2, byDay: ["MO", "TH"], end: NEVER },
    false,
    "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH",
  ],
  [
    {
      freq: "weekly",
      interval: 1,
      byDay: ["MO", "TU", "WE", "TH", "FR"],
      end: { kind: "until", date: "2027-01-15" },
    },
    false,
    "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR;UNTIL=20270115T235959",
  ],
  [
    {
      freq: "monthly",
      interval: 1,
      monthly: { day: 31 },
      end: { kind: "until", date: "2027-01-15" },
    },
    true,
    "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31;UNTIL=20270115",
  ],
  [
    {
      freq: "monthly",
      interval: 1,
      monthly: { pos: 2, weekday: "TU" },
      end: NEVER,
    },
    false,
    "FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU",
  ],
  [
    {
      freq: "monthly",
      interval: 6,
      monthly: { pos: -1, weekday: "FR" },
      end: { kind: "count", count: 999 },
    },
    false,
    "FREQ=MONTHLY;INTERVAL=6;BYDAY=-1FR;COUNT=999",
  ],
  [
    { freq: "yearly", interval: 1, yearly: { month: 2, day: 29 }, end: NEVER },
    true,
    "FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29",
  ],
];

describe("toRRule and fromRRule (RF-3, RF-4, plan D5)", () => {
  it.each(ROUND_TRIPS)("%j ↔ %s", (rule, allDay, text) => {
    expect(toRRule(rule, allDay)).toBe(text);
    expect(fromRRule(text)).toEqual(rule);
  });

  it("accepts intervals 1 to 99 and counts 1 to 999", () => {
    expect(fromRRule("FREQ=DAILY;INTERVAL=99")).not.toBeNull();
    expect(fromRRule("FREQ=DAILY;INTERVAL=0")).toBeNull();
    expect(fromRRule("FREQ=DAILY;INTERVAL=100")).toBeNull();
    expect(fromRRule("FREQ=DAILY;INTERVAL=1;COUNT=1")).not.toBeNull();
    expect(fromRRule("FREQ=DAILY;INTERVAL=1;COUNT=0")).toBeNull();
    expect(fromRRule("FREQ=DAILY;INTERVAL=1;COUNT=1000")).toBeNull();
  });

  it("defaults the interval to 1", () => {
    expect(fromRRule("FREQ=DAILY")).toEqual({
      freq: "daily",
      interval: 1,
      end: NEVER,
    });
  });

  it.each([
    "",
    "RRULE:FREQ=DAILY",
    "FREQ=HOURLY",
    "FREQ=DAILY;BYHOUR=9",
    "FREQ=DAILY;BYDAY=MO",
    "FREQ=WEEKLY;INTERVAL=1",
    "FREQ=WEEKLY;BYDAY=2MO",
    "FREQ=WEEKLY;BYDAY=XX",
    "FREQ=MONTHLY;BYSETPOS=2;BYDAY=TU",
    "FREQ=MONTHLY;BYDAY=5TU",
    "FREQ=MONTHLY;BYDAY=2TU,3WE",
    "FREQ=MONTHLY;BYMONTHDAY=32",
    "FREQ=MONTHLY",
    "FREQ=YEARLY;BYMONTH=13;BYMONTHDAY=1",
    "FREQ=YEARLY;BYMONTHDAY=1",
    "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30",
    "FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=31",
    "FREQ=DAILY;COUNT=2;UNTIL=20270101",
    "FREQ=DAILY;UNTIL=2027",
    "FREQ=DAILY;RDATE=20270101",
    `FREQ=WEEKLY;BYDAY=${Array(60).fill("MO").join(",")}`,
  ])("rejects %s", (text) => {
    expect(fromRRule(text)).toBeNull();
  });
});

// Spec 023, T5: an occurrence moved to another date takes its rule with it
// (RF-7, RF-8, plan D6).
describe("shiftRule", () => {
  const NEVER = { kind: "never" } as const;

  it("moves the weekday of a weekly rule", () => {
    expect(
      shiftRule(
        { freq: "weekly", interval: 1, byDay: ["WE"], end: NEVER },
        "2026-11-11",
        "2026-11-12",
      ),
    ).toMatchObject({ byDay: ["TH"] });
  });

  it("moves every weekday alike, in week order, also backwards", () => {
    expect(
      shiftRule(
        { freq: "weekly", interval: 2, byDay: ["MO", "WE", "SU"], end: NEVER },
        "2026-11-11",
        "2026-11-10",
      ),
    ).toMatchObject({ interval: 2, byDay: ["TU", "SA", "SU"] });
  });

  it("keeps a weekly rule moved whole weeks", () => {
    const rule = {
      freq: "weekly",
      interval: 1,
      byDay: ["WE"],
      end: NEVER,
    } as const;
    expect(
      shiftRule({ ...rule, byDay: ["WE"] }, "2026-11-11", "2026-11-18"),
    ).toEqual(rule);
  });

  it("takes the day of the new date in a monthly rule by day", () => {
    expect(
      shiftRule(
        { freq: "monthly", interval: 1, monthly: { day: 11 }, end: NEVER },
        "2026-11-11",
        "2026-11-20",
      ),
    ).toMatchObject({ monthly: { day: 20 } });
  });

  it("takes the position and weekday of the new date in a monthly rule by position", () => {
    // 11 November 2026 is the second Wednesday; the 19th, the third Thursday.
    expect(
      shiftRule(
        {
          freq: "monthly",
          interval: 1,
          monthly: { pos: 2, weekday: "WE" },
          end: NEVER,
        },
        "2026-11-11",
        "2026-11-19",
      ),
    ).toMatchObject({ monthly: { pos: 3, weekday: "TH" } });
  });

  it("a fifth weekday becomes the last one", () => {
    expect(
      shiftRule(
        {
          freq: "monthly",
          interval: 1,
          monthly: { pos: 2, weekday: "WE" },
          end: NEVER,
        },
        "2026-11-11",
        "2026-11-30",
      ),
    ).toMatchObject({ monthly: { pos: -1, weekday: "MO" } });
  });

  it("takes the month and day of the new date in a yearly rule", () => {
    expect(
      shiftRule(
        {
          freq: "yearly",
          interval: 1,
          yearly: { month: 11, day: 11 },
          end: NEVER,
        },
        "2026-11-11",
        "2026-12-03",
      ),
    ).toMatchObject({ yearly: { month: 12, day: 3 } });
  });

  it("leaves a daily rule and the end as they are", () => {
    const rule = {
      freq: "daily",
      interval: 3,
      end: { kind: "count", count: 5 },
    } as const;
    expect(shiftRule(rule, "2026-11-11", "2026-11-12")).toEqual(rule);
  });
});
