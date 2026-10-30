import { describe, expect, it } from "vitest";
import { monthStrip } from "@/lib/calendar/month-strip";

describe("monthStrip (spec 016 RF-21)", () => {
  const strip = monthStrip("2026-10");

  it("lists the months in order from a year before to two after", () => {
    const months = strip.filter((item) => item.kind === "month");

    expect(months[0]).toMatchObject({ key: "2025-10" });
    expect(months.at(-1)).toMatchObject({ key: "2028-10" });
    expect(months).toHaveLength(37);
  });

  it("writes the year between December and January only", () => {
    const index = strip.findIndex(
      (item) => item.kind === "month" && item.key === "2026-12",
    );

    expect(strip[index + 1]).toEqual({ kind: "year", label: "2027" });
    expect(strip[index + 2]).toMatchObject({ key: "2027-01", label: "ene" });
    expect(strip.filter((item) => item.kind === "year")).toHaveLength(3);
  });

  it("marks the visible month and abbreviates the names", () => {
    expect(
      strip.filter((item) => item.kind === "month" && item.current),
    ).toEqual([{ kind: "month", key: "2026-10", label: "oct", current: true }]);
  });
});
