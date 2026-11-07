import { describe, expect, it } from "vitest";
import { flightKeyframes } from "@/lib/motion/flight";

// Spec 021, T2: a block returns along an arc (RF-20..RF-22).
const to = { left: 100, top: 100, width: 80, height: 40 };
const translate = (frame: Keyframe) =>
  String(frame.translate)
    .split(" ")
    .map((v) => parseFloat(v));

/** Distance of each frame from the straight line between start and end. */
function maxSeparation(frames: Keyframe[]): number {
  const [x0, y0] = translate(frames[0]);
  const length = Math.hypot(x0, y0);
  return Math.max(
    ...frames.map((f) => {
      const [x, y] = translate(f);
      return Math.abs(x * y0 - y * x0) / length;
    }),
  );
}

describe("flightKeyframes", () => {
  it("starts at the offset and ends at 0", () => {
    const from = { ...to, left: 300, top: 160 };
    const frames = flightKeyframes(from, to);
    expect(translate(frames[0])).toEqual([200, 60]);
    expect(translate(frames.at(-1)!)).toEqual([0, 0]);
  });

  it("arcs up to 32 px on a long trip", () => {
    const frames = flightKeyframes({ ...to, left: 500 }, to);
    const separation = maxSeparation(frames);
    expect(separation).toBeGreaterThan(30);
    expect(separation).toBeLessThanOrEqual(32);
  });

  it("arcs a quarter of a medium trip", () => {
    const separation = maxSeparation(flightKeyframes({ ...to, left: 180 }, to));
    expect(separation).toBeLessThanOrEqual(20);
    expect(separation).toBeGreaterThan(15);
  });

  it("goes straight under 48 px", () => {
    const frames = flightKeyframes({ ...to, left: 140 }, to);
    expect(maxSeparation(frames)).toBeCloseTo(0);
  });
});
