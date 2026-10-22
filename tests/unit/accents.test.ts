import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/calendar/palette";
import {
  ACCENTS,
  DEFAULT_ACCENT,
  NEUTRALS,
  accentSchema,
  isAccent,
} from "@/lib/theme/accents";

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

  it("accepts only those six", () => {
    expect(isAccent("blue")).toBe(true);
    expect(isAccent("pink")).toBe(false);
    expect(isAccent("")).toBe(false);
    expect(accentSchema.safeParse("gray").success).toBe(true);
    expect(accentSchema.safeParse("Red").success).toBe(false);
    expect(accentSchema.safeParse(undefined).success).toBe(false);
  });

  it.each(ACCENTS)("$id reaches 4.5:1 for text (RF-14)", (accent) => {
    expect(contrastRatio(accent.onFill, accent.fill)).toBeGreaterThanOrEqual(
      4.5,
    );
    for (const surface of [NEUTRALS.stone, NEUTRALS.paper]) {
      expect(contrastRatio(accent.ink, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(ACCENTS)(
    "$id fills stay 3:1 apart from the surface, or draw an edge (RF-14, plan R6)",
    (accent) => {
      const faint = [NEUTRALS.stone, NEUTRALS.paper].some(
        (surface) => contrastRatio(accent.fill, surface) < 3,
      );
      expect(accent.edge).toBe(faint ? accent.ink : accent.fill);
      expect(contrastRatio(accent.edge, NEUTRALS.stone)).toBeGreaterThanOrEqual(
        3,
      );
    },
  );

  it("neutral text keeps 4.5:1 and control borders 3:1 on both surfaces", () => {
    for (const surface of [NEUTRALS.stone, NEUTRALS.paper]) {
      expect(contrastRatio(NEUTRALS.ink, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(NEUTRALS.muted, surface)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(NEUTRALS.danger, surface)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(NEUTRALS.control, surface)).toBeGreaterThanOrEqual(
        3,
      );
    }
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
