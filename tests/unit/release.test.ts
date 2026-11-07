import { describe, expect, it } from "vitest";
import { lockAxis, releaseDecision, trackVelocity } from "@/lib/motion/release";

// Spec 021, T2: what a released gesture does (RF-25, RF-27..RF-29).
describe("releaseDecision", () => {
  it("goes forward or back past the distance threshold", () => {
    expect(releaseDecision({ delta: -60, velocity: 0, threshold: 50 })).toBe(
      "forward",
    );
    expect(releaseDecision({ delta: 60, velocity: 0, threshold: 50 })).toBe(
      "back",
    );
  });

  it("goes with a flick shorter than the threshold", () => {
    expect(releaseDecision({ delta: -20, velocity: -0.6, threshold: 50 })).toBe(
      "forward",
    );
    expect(releaseDecision({ delta: 20, velocity: 0.6, threshold: 50 })).toBe(
      "back",
    );
  });

  it("stays when the gesture is short and slow", () => {
    expect(releaseDecision({ delta: -30, velocity: -0.3, threshold: 50 })).toBe(
      "stay",
    );
    expect(releaseDecision({ delta: 0, velocity: 0, threshold: 50 })).toBe(
      "stay",
    );
  });
});

describe("lockAxis", () => {
  it("waits for 10 px", () => {
    expect(lockAxis(6, 5)).toBeNull();
  });

  it("locks the dominant axis", () => {
    expect(lockAxis(12, 3)).toBe("x");
    expect(lockAxis(-3, -14)).toBe("y");
  });
});

describe("trackVelocity", () => {
  it("only counts the samples of the last 100 ms", () => {
    const track = trackVelocity();
    track.add(0, 0);
    track.add(500, 1000);
    track.add(520, 1100);
    track.add(600, 1150);
    // Only the samples from 1050 on count: 520 at 1100 and 600 at 1150.
    expect(track.velocity()).toBeCloseTo(80 / 50);
  });

  it("is 0 with fewer than two samples", () => {
    const track = trackVelocity();
    expect(track.velocity()).toBe(0);
    track.add(10, 5);
    expect(track.velocity()).toBe(0);
  });
});
