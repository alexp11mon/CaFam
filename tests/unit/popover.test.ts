import { describe, expect, it } from "vitest";
import { placeCard, placePopover } from "@/lib/calendar/popover";

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

// Spec 019, T9: the detail card beside the event (RF-2).
describe("placeCard", () => {
  const CARD = { width: 360, height: 280 };

  it("goes to the right of the event when it fits whole", () => {
    const anchor = { left: 600, top: 300, width: 120, height: 48 };
    expect(placeCard(anchor, CARD, VIEWPORT)).toEqual({
      left: 600 + 120 + GAP,
      top: 300,
      side: "right",
    });
  });

  it("goes to the left when the right has no room", () => {
    const anchor = { left: 1200, top: 300, width: 120, height: 48 };
    expect(placeCard(anchor, CARD, VIEWPORT)).toEqual({
      left: 1200 - GAP - 360,
      top: 300,
      side: "left",
    });
  });

  it("goes below a wide anchor when neither side has room, or above if there is more room", () => {
    const wide = { left: 100, top: 200, width: 1240, height: 18 };
    expect(placeCard(wide, CARD, VIEWPORT)).toMatchObject({
      top: 200 + 18 + GAP,
      side: "below",
    });
    const low = { left: 100, top: 700, width: 1240, height: 18 };
    expect(placeCard(low, CARD, VIEWPORT)).toMatchObject({
      top: 700 - GAP - 280,
      side: "above",
    });
  });

  it("never leaves the screen", () => {
    const corner = { left: 1300, top: 850, width: 120, height: 40 };
    const { left, top } = placeCard(corner, CARD, VIEWPORT);
    expect(left).toBeGreaterThanOrEqual(MARGIN);
    expect(left + CARD.width).toBeLessThanOrEqual(VIEWPORT.width - MARGIN);
    expect(top).toBeGreaterThanOrEqual(MARGIN);
    expect(top + CARD.height).toBeLessThanOrEqual(VIEWPORT.height - MARGIN);
  });
});
