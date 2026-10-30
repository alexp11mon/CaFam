import { describe, expect, it } from "vitest";
import { THEME_INKS } from "@/lib/theme/accents";
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

  it("defaults to sky blue and no longer offers the old blue (spec 005 RF-55, RF-56)", () => {
    expect(DEFAULT_CALENDAR_COLOR).toBe("#A0C4FF");
    expect(isPaletteColor(DEFAULT_CALENDAR_COLOR)).toBe(true);
    expect(isPaletteColor("#2563EB")).toBe(false);
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

  it("uses white on a dark color and dark ink on pastel colors", () => {
    expect(readableTextColor("#1D4ED8")).toBe("#FFFFFF");
    expect(readableTextColor("#FDFFB6")).toBe("#141414");
  });

  it("works with any valid hex, not only palette colors", () => {
    expect(readableTextColor("#000000")).toBe("#FFFFFF");
    expect(readableTextColor("#ffffff")).toBe("#141414");
  });
});

// Spec 008, T17 (plan D9): all-day bars of the month are filled with the
// calendar color and keep their text in ink, so every color must read well.
describe("ink on every palette color", () => {
  it("reaches at least 4.5:1", () => {
    for (const color of CALENDAR_COLORS) {
      expect(contrastRatio("#141414", color.value)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// Spec 016 RF-3: every event is now a filled block, in both themes.
describe("text of the event blocks on every palette color", () => {
  it.each(["light", "dark"] as const)(
    "reaches 4.5:1 in the %s theme",
    (theme) => {
      for (const color of CALENDAR_COLORS) {
        expect(
          contrastRatio(THEME_INKS[theme].pastelInk, color.value),
          `${theme} ${color.label}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
