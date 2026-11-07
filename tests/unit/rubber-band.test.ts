import { describe, expect, it } from "vitest";
import { banded, rubberBand } from "@/lib/motion/rubber-band";

// Spec 021, T2: past a limit the surface follows less and less (RF-32, RF-33).
describe("rubberBand", () => {
  it("is 0 without excess", () => {
    expect(rubberBand(0)).toBe(0);
    expect(rubberBand(-20)).toBe(0);
  });

  it("grows, stays under the maximum and slows down", () => {
    let last = 0;
    let lastStep = Infinity;
    for (let excess = 10; excess <= 2000; excess += 10) {
      const value = rubberBand(excess);
      expect(value).toBeGreaterThan(last);
      expect(value).toBeLessThan(64);
      expect(value - last).toBeLessThanOrEqual(lastStep);
      lastStep = value - last;
      last = value;
    }
    expect(rubberBand(10_000, 40)).toBeLessThan(40);
  });
});

describe("banded", () => {
  it("leaves values inside the interval alone", () => {
    expect(banded(50, 24, 144)).toBe(50);
    expect(banded(24, 24, 144)).toBe(24);
    expect(banded(144, 24, 144)).toBe(144);
  });

  it("bands past either end", () => {
    expect(banded(200, 24, 144)).toBeCloseTo(144 + rubberBand(56));
    expect(banded(0, 24, 144)).toBeCloseTo(24 - rubberBand(24));
    expect(banded(10_000, 24, 144, 20)).toBeLessThan(164);
  });
});
