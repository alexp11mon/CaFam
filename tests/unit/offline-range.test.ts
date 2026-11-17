import { describe, expect, it } from "vitest";
import { addMonths, coversRange, offlineRange } from "@/lib/offline/range";

describe("addMonths", () => {
  it("moves by whole months and keeps the day", () => {
    expect(addMonths("2026-11-17", -1)).toBe("2026-10-17");
    expect(addMonths("2026-11-17", 3)).toBe("2027-02-17");
  });

  it("stops at the last day of a shorter month", () => {
    expect(addMonths("2026-05-31", -1)).toBe("2026-04-30");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2027-11-30", 3)).toBe("2028-02-29");
  });

  it("crosses the year backwards", () => {
    expect(addMonths("2027-01-15", -1)).toBe("2026-12-15");
  });
});

describe("offlineRange (spec 034 RF-1)", () => {
  it("goes from a month before today to three after", () => {
    expect(offlineRange("2026-11-17")).toEqual({
      from: "2026-10-17",
      to: "2027-02-17",
    });
  });
});

describe("coversRange (RF-11)", () => {
  const range = { from: "2026-10-17", to: "2027-02-17" };

  it("accepts the days inside, ends included", () => {
    expect(coversRange(range, { from: "2026-10-17", to: "2026-10-23" })).toBe(
      true,
    );
    expect(coversRange(range, { from: "2027-02-17", to: "2027-02-17" })).toBe(
      true,
    );
  });

  it("refuses a period that leaves the copy on either side", () => {
    expect(coversRange(range, { from: "2026-10-12", to: "2026-10-18" })).toBe(
      false,
    );
    expect(coversRange(range, { from: "2027-02-15", to: "2027-02-21" })).toBe(
      false,
    );
  });
});
