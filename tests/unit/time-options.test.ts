import { describe, expect, it } from "vitest";
import {
  clampEnd,
  endOptions,
  formatDuration,
  fromMinutes,
  normalizeTime,
  shiftEnd,
  startOptions,
  toMinutes,
} from "@/lib/calendar/time-options";

// Spec 008, T7: hour lists and the automatic end time (RF-13, RF-16, RF-17, RF-30, RF-49).
describe("startOptions", () => {
  it("lists 00:00 to 23:30 every 30 minutes", () => {
    const options = startOptions();
    expect(options).toHaveLength(48);
    expect(options[0]).toEqual({ value: "00:00", label: "00:00" });
    expect(options[1]!.value).toBe("00:30");
    expect(options.at(-1)!.value).toBe("23:30");
  });
});

describe("endOptions", () => {
  it("starts after the start time and shows each duration (RF-49)", () => {
    const options = endOptions("10:00");
    expect(options[0]).toEqual({ value: "10:30", label: "10:30 (30 min)" });
    expect(options[1]).toEqual({ value: "11:00", label: "11:00 (1 h)" });
    expect(options[2]).toEqual({ value: "11:30", label: "11:30 (1 h 30 min)" });
    expect(options.at(-1)!.value).toBe("23:30");
  });

  it("keeps the 30-minute grid after an off-grid start", () => {
    expect(endOptions("10:15")[0]).toEqual({
      value: "10:45",
      label: "10:45 (30 min)",
    });
  });

  it("offers 23:59 when nothing on the grid is left", () => {
    expect(endOptions("23:30")).toEqual([
      { value: "23:59", label: "23:59 (29 min)" },
    ]);
  });

  it("falls back to the full list for an invalid start", () => {
    expect(endOptions("x")).toEqual(startOptions());
  });
});

describe("normalizeTime (RF-16)", () => {
  it.each([
    ["09:05", "09:05"],
    ["9:05", "09:05"],
    ["0905", "09:05"],
    ["905", "09:05"],
    ["9", "09:00"],
    [" 21:30 ", "21:30"],
    ["23:59", "23:59"],
  ])("reads %j as %j", (input, output) => {
    expect(normalizeTime(input)).toBe(output);
  });

  it.each(["24:00", "9:60", "abc", "", "12:3"])("rejects %j", (input) => {
    expect(normalizeTime(input)).toBeNull();
  });
});

describe("shiftEnd and clampEnd (RF-17, RF-30)", () => {
  it("moves the end keeping the duration", () => {
    expect(shiftEnd("09:00", "10:30", "10:00")).toBe("11:30");
  });

  it("never goes past 23:59", () => {
    expect(shiftEnd("09:00", "23:00", "11:00")).toBe("23:59");
    expect(clampEnd(24 * 60 + 30)).toBe(23 * 60 + 59);
  });

  it("uses one hour when the old times are not valid", () => {
    expect(shiftEnd("x", "10:00", "y")).toBe("11:00");
  });
});

describe("helpers", () => {
  it("converts and formats", () => {
    expect(toMinutes("10:30")).toBe(630);
    expect(fromMinutes(630)).toBe("10:30");
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(150)).toBe("2 h 30 min");
  });
});
