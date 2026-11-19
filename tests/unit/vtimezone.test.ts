import { describe, expect, it } from "vitest";
import { vtimezone } from "@/lib/ics/vtimezone";

// Spec 043, T1: VTIMEZONE from Intl, year ±2 (plan "Resumen").
describe("vtimezone", () => {
  it("writes the daylight saving transitions of Europe/Madrid", () => {
    const lines = vtimezone("Europe/Madrid", 2026);
    expect(lines[0]).toBe("BEGIN:VTIMEZONE");
    expect(lines).toContain("TZID:Europe/Madrid");
    // 29 March 2026, 02:00 local (+01:00) -> +02:00.
    const spring = lines.indexOf("DTSTART:20260329T020000");
    expect(spring).toBeGreaterThan(0);
    expect(lines.slice(spring - 3, spring + 1)).toEqual([
      "BEGIN:DAYLIGHT",
      "TZOFFSETFROM:+0100",
      "TZOFFSETTO:+0200",
      "DTSTART:20260329T020000",
    ]);
    // 25 October 2026, 03:00 local (+02:00) -> +01:00.
    expect(lines).toContain("DTSTART:20261025T030000");
    // From 2024 to 2028: two transitions a year.
    expect(lines.filter((line) => line === "BEGIN:DAYLIGHT")).toHaveLength(5);
    expect(lines.filter((line) => line === "BEGIN:STANDARD")).toHaveLength(5);
    expect(lines.at(-1)).toBe("END:VTIMEZONE");
  });

  it("writes one standard block for a zone without changes", () => {
    const lines = vtimezone("Asia/Kolkata", 2026);
    expect(lines).toEqual([
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Kolkata",
      "BEGIN:STANDARD",
      "TZOFFSETFROM:+0530",
      "TZOFFSETTO:+0530",
      "DTSTART:19700101T000000",
      "END:STANDARD",
      "END:VTIMEZONE",
    ]);
  });
});
