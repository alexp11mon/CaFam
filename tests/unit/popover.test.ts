import { describe, expect, it } from "vitest";
import { placePopover } from "@/lib/calendar/popover";

// Spec 008, T13: the quick window opens next to the chosen slot (RF-37).
const VIEWPORT = { width: 1440, height: 900 };
const SIZE = { width: 400, height: 300 };
const GAP = 8;
const MARGIN = 16;

describe("placePopover", () => {
  it("goes to the right of the slot when it fits", () => {
    const anchor = { left: 600, top: 300, width: 120, height: 48 };
    expect(placePopover(anchor, SIZE, VIEWPORT)).toEqual({
      left: 600 + 120 + GAP,
      top: 300,
    });
  });

  it("goes to the left when the right side has no room", () => {
    const anchor = { left: 1200, top: 300, width: 120, height: 48 };
    expect(placePopover(anchor, SIZE, VIEWPORT)).toEqual({
      left: 1200 - GAP - 400,
      top: 300,
    });
  });

  it("never leaves the screen", () => {
    const low = { left: 600, top: 800, width: 120, height: 48 };
    expect(placePopover(low, SIZE, VIEWPORT).top).toBe(900 - 300 - MARGIN);

    const narrow = { left: 100, top: 100, width: 100, height: 48 };
    const tiny = { width: 450, height: 900 };
    const place = placePopover(narrow, SIZE, tiny);
    expect(place.left).toBeGreaterThanOrEqual(MARGIN);
    expect(place.left + SIZE.width).toBeLessThanOrEqual(450 - MARGIN + 1);
    expect(place.top).toBeGreaterThanOrEqual(MARGIN);
  });
});
