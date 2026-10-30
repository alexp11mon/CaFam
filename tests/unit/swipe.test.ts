import { describe, expect, it } from "vitest";
import { swipeDirection } from "@/lib/calendar/swipe";

describe("swipeDirection (spec 016 RF-25..RF-27)", () => {
  it("goes to the next period when sliding to the left", () => {
    expect(swipeDirection(-80, 10)).toBe("next");
  });

  it("goes to the previous period when sliding to the right", () => {
    expect(swipeDirection(80, -10)).toBe("previous");
  });

  it("ignores a slide under 50 px", () => {
    expect(swipeDirection(-49, 0)).toBeNull();
  });

  it("ignores a slide more vertical than horizontal", () => {
    expect(swipeDirection(-60, 70)).toBeNull();
    expect(swipeDirection(60, 60)).toBeNull();
  });
});
