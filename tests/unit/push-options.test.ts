import { describe, expect, it } from "vitest";
import { parseReminders, validFor } from "@/lib/push/options";

// Spec 040, T6: the reminders field of the event form (RF-5).
describe("parseReminders", () => {
  it("reads none, a list, and refuses what is not a choice", () => {
    expect(parseReminders("none")).toEqual([]);
    expect(parseReminders("60,10")).toEqual([10, 60]);
    expect(parseReminders("10,10")).toEqual([10]);
    expect(parseReminders("7")).toBeNull();
    expect(parseReminders("0,5,10,15")).toBeNull();
    expect(parseReminders("")).toBeNull();
    expect(parseReminders(null)).toBeNull();
  });
});

describe("validFor", () => {
  it("keeps only the choices of all-day events", () => {
    expect(validFor(true, [10, 1440])).toEqual([1440]);
    expect(validFor(false, [10, 1440])).toEqual([10, 1440]);
  });
});
