import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION,
  DURATIONS,
  durationSchema,
  parseDuration,
  visibleDays,
} from "@/lib/calendar/view-options";
import { getVisibleRange } from "@/lib/calendar/ranges";

// Spec 019, T5: the days a view draws and the default duration (RF-25 to RF-27, RF-30).
const WEEK = [
  "2026-11-02",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
];

describe("visibleDays", () => {
  it("keeps every day with weekends shown", () => {
    expect(visibleDays(WEEK, true)).toEqual(WEEK);
  });

  it("on a Saturday, keeps Monday to Friday of that week", () => {
    const { days } = getVisibleRange("week", "2026-11-07", "Europe/Madrid");
    expect(visibleDays(days, false)).toEqual(WEEK.slice(0, 5));
  });

  it("drops Saturday and Sunday otherwise", () => {
    expect(visibleDays(WEEK, false)).toEqual(WEEK.slice(0, 5));
  });
});

describe("durations", () => {
  it("offers 15 to 120 minutes, 60 by default", () => {
    expect(DURATIONS).toEqual([15, 30, 45, 60, 90, 120]);
    expect(DEFAULT_DURATION).toBe(60);
  });

  it("accepts only the listed values", () => {
    expect(durationSchema.safeParse(45).success).toBe(true);
    const wrong = durationSchema.safeParse(20);
    expect(wrong.success).toBe(false);
    expect(wrong.error?.issues[0]?.message).toBe(
      "Elige una duración de la lista.",
    );
  });

  it("falls back to 60 for anything unknown", () => {
    expect(parseDuration(90)).toBe(90);
    expect(parseDuration(20)).toBe(60);
    expect(parseDuration(null)).toBe(60);
  });
});
