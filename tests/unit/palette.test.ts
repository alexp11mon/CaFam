import { describe, expect, it } from "vitest";
import {
  CALENDAR_COLORS,
  DEFAULT_CALENDAR_COLOR,
  contrastRatio,
  isPaletteColor,
  readableTextColor,
} from "@/lib/calendar/palette";

describe("CALENDAR_COLORS (RF-2)", () => {
  it("offers at least 12 distinct colors with a label each", () => {
    const values = CALENDAR_COLORS.map((color) => color.value.toLowerCase());

    expect(CALENDAR_COLORS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(values).size).toBe(values.length);
    for (const color of CALENDAR_COLORS) {
      expect(color.value).toMatch(/^#[0-9A-F]{6}$/);
      expect(color.label.length).toBeGreaterThan(0);
    }
  });

  it("includes the default blue of spec 001", () => {
    expect(DEFAULT_CALENDAR_COLOR).toBe("#2563EB");
    expect(isPaletteColor("#2563EB")).toBe(true);
  });
});

describe("isPaletteColor", () => {
  it("accepts palette colors in any case and rejects others", () => {
    expect(isPaletteColor("#a0c4ff")).toBe(true);
    expect(isPaletteColor("#123456")).toBe(false);
    expect(isPaletteColor("azul")).toBe(false);
    expect(isPaletteColor("")).toBe(false);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for equal colors", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });
});

describe("readableTextColor (RNF contrast)", () => {
  it("gives at least 4.5:1 text contrast for every palette color (RF-17)", () => {
    for (const { value, label } of CALENDAR_COLORS) {
      const text = readableTextColor(value);

      expect(
        contrastRatio(text, value),
        `${label} ${value} with ${text}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses white on the brand blue and dark ink on pastel colors", () => {
    expect(readableTextColor("#2563EB")).toBe("#FFFFFF");
    expect(readableTextColor("#FDFFB6")).toBe("#0D160B");
  });

  it("works with any valid hex, not only palette colors", () => {
    expect(readableTextColor("#000000")).toBe("#FFFFFF");
    expect(readableTextColor("#ffffff")).toBe("#0D160B");
  });
});
