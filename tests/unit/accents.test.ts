import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALENDAR_COLORS,
  contrastRatio as ratio,
} from "@/lib/calendar/palette";
import {
  ACCENTS,
  BACKDROP,
  DARK_NEUTRALS,
  DEFAULT_ACCENT,
  GLASS,
  NEUTRALS,
  THEME_INKS,
  accentSchema,
  isAccent,
} from "@/lib/theme/accents";
import { composite } from "@/lib/theme/contrast";

// Spec 005, T2: the six accents, their contrast and their CSS tokens
// (RF-3, RF-6, RF-10, RF-11, RF-14; plan "Modelo de datos", D2).
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function block(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

function variable(source: string, name: string): string | undefined {
  return source
    .match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
    ?.toUpperCase();
}

describe("accents", () => {
  it("are the six of the spec, in Spanish, with red by default (RF-6, RF-10)", () => {
    expect(ACCENTS.map((accent) => [accent.id, accent.label])).toEqual([
      ["red", "Rojo"],
      ["blue", "Azul"],
      ["green", "Verde"],
      ["yellow", "Amarillo"],
      ["purple", "Morado"],
      ["gray", "Gris"],
    ]);
    expect(DEFAULT_ACCENT).toBe("red");
  });

  it("never use the old blue; Azul has its own darker tone (spec 005 RF-58)", () => {
    for (const accent of ACCENTS) {
      expect(
        [accent.fill, accent.ink, accent.edge].map((c) => c.toUpperCase()),
      ).not.toContain("#2563EB");
    }
    expect(ACCENTS.find((accent) => accent.id === "blue")).toMatchObject({
      fill: "#1D4ED8",
      ink: "#1E40AF",
      edge: "#1D4ED8",
    });
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
  const surfaces = [neutrals.stone, neutrals.paper, ...BACKDROP[theme]];

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

  it("keeps the text on glass at 4.5:1 over the worst background (RF-15, D7)", () => {
    const behind = [
      ...surfaces,
      neutrals.ink,
      ...ACCENTS.map((accent) => accent.fill),
      ...CALENDAR_COLORS.map((color) => color.value),
    ];
    const texts = [
      neutrals.ink,
      neutrals.muted,
      ...ACCENTS.map((accent) => onSurface(accent, theme).ink),
    ];
    for (const back of behind) {
      const glass = composite(GLASS[theme].bg, GLASS[theme].alpha, back);
      for (const text of texts) {
        expect(ratio(text, glass), `${text} on ${back}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
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

  it("keeps the brand mark the same in both themes (D5)", () => {
    expect(THEME_INKS.light.mark).toBe(THEME_INKS.dark.mark);
    expect(THEME_INKS.light.onMark).toBe(THEME_INKS.dark.onMark);
  });
});

describe("composite", () => {
  it("mixes a color over another with its alpha", () => {
    expect(composite("#FFFFFF", 1, "#000000")).toBe("#FFFFFF");
    expect(composite("#FFFFFF", 0, "#000000")).toBe("#000000");
    expect(composite("#FFFFFF", 0.5, "#000000")).toBe("#808080");
  });
});

describe("globals.css", () => {
  it("defines every neutral as a theme color", () => {
    const theme = block("@theme {");
    for (const [name, value] of Object.entries(NEUTRALS)) {
      expect(variable(theme, `color-${name}`), name).toBe(value);
    }
  });

  it("paints red on :root, for pages without a session (RF-11)", () => {
    const root = block(":root");
    const red = ACCENTS.find((accent) => accent.id === DEFAULT_ACCENT)!;
    expect(variable(root, "accent")).toBe(red.fill);
    expect(variable(root, "accent-ink")).toBe(red.ink);
  });

  it.each(ACCENTS)("has the same values as accents.ts for $id", (accent) => {
    const rules = block(`[data-accent="${accent.id}"]`);
    expect(variable(rules, "accent")).toBe(accent.fill);
    expect(variable(rules, "on-accent")).toBe(accent.onFill);
    expect(variable(rules, "accent-ink")).toBe(accent.ink);
    expect(variable(rules, "accent-edge")).toBe(accent.edge);
  });
});
