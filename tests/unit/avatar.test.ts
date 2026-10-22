import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/calendar/palette";
import { assignTints, initials, PERSON_TINTS } from "@/lib/people/avatar";
import { NEUTRALS } from "@/lib/theme/accents";

// Spec 005, T4: people as initials on a pale tint of their own
// (RF-27, RF-28; plan D11).

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(
    (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
  ) as [number, number, number];
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const raw =
    max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return (raw * 60 + 360) % 360;
}

describe("initials (RF-27, casos límite)", () => {
  it.each([
    ["Ana López", "AL"],
    ["ana maría lópez", "AM"],
    ["Bea", "B"],
    ["  Carlos   Ruiz  ", "CR"],
    ["3D Estudio", "3E"],
    ["¡Hola! Mundo", "¡M"],
    ["Élodie", "É"],
    ["", "?"],
  ])("%j → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe("tints (RF-28)", () => {
  it("are six pale colors at least 60 degrees of hue apart, readable with ink", () => {
    expect(PERSON_TINTS).toHaveLength(6);
    const hues = PERSON_TINTS.map(hue);
    for (const [index, first] of hues.entries()) {
      for (const second of hues.slice(index + 1)) {
        const distance = Math.abs(first - second);
        // Generated 60 degrees apart; rounding to 8-bit hex moves a hue by < 2.
        expect(Math.min(distance, 360 - distance)).toBeGreaterThanOrEqual(58);
      }
    }
    for (const tint of PERSON_TINTS) {
      expect(contrastRatio(NEUTRALS.ink, tint)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives everyone the same tint whatever the order of the list", () => {
    const first = assignTints(["c", "a", "b"]);
    const second = assignTints(["b", "c", "a", "a"]);

    expect(Object.fromEntries(first)).toEqual(Object.fromEntries(second));
  });

  it("does not repeat a tint until the seventh person", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const tints = assignTints(ids);

    expect(new Set(ids.slice(0, 6).map((id) => tints.get(id))).size).toBe(6);
    expect(tints.get("p7")).toBe(tints.get("p1"));
  });
});
