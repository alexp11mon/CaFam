import { describe, expect, it } from "vitest";
import { dateFormat, formatList, formatNumber } from "@/lib/i18n/format";

// Spec 053 T1: Intl in the chosen language, 24-hour clock in both (RF-4, D3).
describe("format", () => {
  const date = new Date("2026-11-26T17:05:00Z");
  const options = {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  } as const;

  it("writes dates in each language with a 24-hour clock", () => {
    expect(dateFormat("es", options).format(date)).toMatch(
      /jueves, 26 de noviembre.*18:05/,
    );
    const en = dateFormat("en", options).format(date);
    expect(en).toMatch(/Thursday.*26 November.*18:05/);
    expect(en).not.toMatch(/PM/i);
  });

  it("joins lists and groups numbers", () => {
    expect(formatList("es", ["Ana", "Luis", "Eva"])).toBe("Ana, Luis y Eva");
    expect(formatList("en", ["Ana", "Luis", "Eva"])).toBe("Ana, Luis and Eva");
    expect(formatNumber("es", 2000)).toBe("2.000");
    expect(formatNumber("en", 2000)).toBe("2,000");
  });
});
