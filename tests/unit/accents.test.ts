import { accentSchema } from "@/lib/theme/schemas";
import { describe, expect, it } from "vitest";
import {
  CALENDAR_COLORS,
  contrastRatio as ratio,
} from "@/lib/calendar/palette";
import {
  ACCENTS,
  BRAND,
  DARK_NEUTRALS,
  DEFAULT_ACCENT,
  NEUTRALS,
  THEME_INKS,
  isAccent,
} from "@/lib/theme/accents";
import { composite } from "@/lib/theme/contrast";

// Spec 005, T2: the six accents, their contrast and their CSS tokens
// (RF-3, RF-6, RF-10, RF-11, RF-14; plan "Modelo de datos", D2).
describe("accents", () => {
  it("are the six of the spec, in Spanish, with red by default (RF-6, RF-10)", () => {
    expect(ACCENTS.map((accent) => [accent.id, accent.label])).toEqual([
      // Spec 030 RF-3: the names of the Nexo identity, the same stored ids.
      ["red", "Violeta"],
      ["blue", "Azul"],
      ["green", "Verde"],
      ["yellow", "Ámbar"],
      ["purple", "Rosa"],
      ["gray", "Grafito"],
    ]);
    expect(DEFAULT_ACCENT).toBe("red");
  });

  it("never use the old blue (spec 005 RF-58)", () => {
    for (const accent of ACCENTS) {
      expect(
        [accent.fill, accent.ink, accent.edge].map((c) => c.toUpperCase()),
      ).not.toContain("#2563EB");
    }
  });

  it("accepts only those six", () => {
    expect(isAccent("blue")).toBe(true);
    expect(isAccent("pink")).toBe(false);
    expect(isAccent("")).toBe(false);
    expect(accentSchema.safeParse("gray").success).toBe(true);
    expect(accentSchema.safeParse("Red").success).toBe(false);
    expect(accentSchema.safeParse(undefined).success).toBe(false);
  });

  it.each(ACCENTS)("$id reaches 4.5:1 for text (RF-14)", (accent) => {
    expect(ratio(accent.onFill, accent.fill)).toBeGreaterThanOrEqual(4.5);
    // Also at the far end of its gradient (spec 030 RF-2).
    expect(ratio(accent.onFill, accent.to)).toBeGreaterThanOrEqual(4.5);
    for (const surface of [NEUTRALS.stone, NEUTRALS.paper]) {
      expect(ratio(accent.ink, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(ACCENTS)(
    "$id fills stay 3:1 apart from the surface, or draw an edge (RF-14, plan R6)",
    (accent) => {
      const faint = [NEUTRALS.stone, NEUTRALS.paper].some(
        (surface) => ratio(accent.fill, surface) < 3,
      );
      expect(accent.edge).toBe(faint ? accent.ink : accent.fill);
      expect(ratio(accent.edge, NEUTRALS.stone)).toBeGreaterThanOrEqual(3);
    },
  );

  it("neutral text keeps 4.5:1 and control borders 3:1 on both surfaces", () => {
    for (const surface of [NEUTRALS.stone, NEUTRALS.paper]) {
      expect(ratio(NEUTRALS.ink, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NEUTRALS.muted, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NEUTRALS.danger, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NEUTRALS.control, surface)).toBeGreaterThanOrEqual(3);
    }
  });
});

// Spec 011, T3: the dark theme and the glass keep P9 in both themes (RF-9,
// RF-10, RF-15; plan "Modelo de datos", D5, D7).
type AccentValue = (typeof ACCENTS)[number];

/** In the light theme ink and edge are the accent's own values. */
function onSurface(accent: AccentValue, theme: "light" | "dark") {
  return theme === "light" ? accent : accent.dark;
}

const THEMES = [
  { name: "light", neutrals: NEUTRALS, theme: "light" as const },
  { name: "dark", neutrals: DARK_NEUTRALS, theme: "dark" as const },
];

describe.each(THEMES)("the $name theme", ({ neutrals, theme }) => {
  // Spec 025 RF-3: opaque surfaces only, no glass and no gradient backdrop.
  const surfaces = [neutrals.stone, neutrals.paper];

  it("keeps neutral text at 4.5:1 and borders at 3:1 on every surface", () => {
    for (const surface of surfaces) {
      expect(ratio(neutrals.ink, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(neutrals.muted, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(neutrals.danger, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(neutrals.control, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the text of the ink button at 4.5:1 (D5)", () => {
    expect(ratio(THEME_INKS[theme].onInk, neutrals.ink)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(ratio(neutrals.ink, neutrals.stone)).toBeGreaterThanOrEqual(3);
  });

  it.each(ACCENTS)("keeps $id readable (RF-9)", (accent) => {
    const { ink, edge } = onSurface(accent, theme);
    expect(ratio(accent.onFill, accent.fill)).toBeGreaterThanOrEqual(4.5);
    for (const surface of [neutrals.stone, neutrals.paper]) {
      expect(ratio(ink, surface)).toBeGreaterThanOrEqual(4.5);
    }
    const faint = [neutrals.stone, neutrals.paper].some(
      (surface) => ratio(accent.fill, surface) < 3,
    );
    expect(edge).toBe(faint ? ink : accent.fill);
  });
});

describe("pastel ink (RF-10)", () => {
  it("is the same dark ink in both themes and reads on every pastel", () => {
    expect(THEME_INKS.light.pastelInk).toBe(THEME_INKS.dark.pastelInk);
    for (const color of CALENDAR_COLORS) {
      expect(
        ratio(THEME_INKS.dark.pastelInk, color.value),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the brand mark visible on the stone of each theme (D5)", () => {
    const stones = { light: NEUTRALS.stone, dark: DARK_NEUTRALS.stone };
    for (const theme of ["light", "dark"] as const) {
      const { mark, onMark } = THEME_INKS[theme];
      expect(ratio(mark, stones[theme])).toBeGreaterThanOrEqual(3);
      expect(ratio(onMark, mark)).toBeGreaterThanOrEqual(4.5);
      // Spec 025 RF-7: the coral tile, whatever the accent and the theme.
      expect(mark).toBe(BRAND.tile);
    }
  });
});

describe("composite", () => {
  it("mixes a color over another with its alpha", () => {
    expect(composite("#FFFFFF", 1, "#000000")).toBe("#FFFFFF");
    expect(composite("#FFFFFF", 0, "#000000")).toBe("#000000");
    expect(composite("#FFFFFF", 0.5, "#000000")).toBe("#808080");
  });
});
