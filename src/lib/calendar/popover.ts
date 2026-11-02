export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where an element is on screen, as placePopover expects it. */
export function boxOf(element: Element): Box {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}

const GAP = 8;
const MARGIN = 16;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**
 * Where the quick window goes: beside the chosen slot, on its right if it fits
 * and on its left otherwise, always inside the screen (spec 008 RF-37).
 */
export function placePopover(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const right = anchor.left + anchor.width + GAP;
  const left =
    right + size.width <= viewport.width - MARGIN
      ? right
      : anchor.left - GAP - size.width;
  return {
    left: clamp(left, MARGIN, viewport.width - MARGIN - size.width),
    top: clamp(anchor.top, MARGIN, viewport.height - MARGIN - size.height),
  };
}

export type CardSide = "right" | "left" | "above" | "below";

/**
 * Where the detail card goes: on the right of the event if it fits whole,
 * else on its left, else above or below where there is more room; always
 * inside the screen (spec 019 RF-2).
 */
export function placeCard(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number; side: CardSide } {
  const maxLeft = viewport.width - MARGIN - size.width;
  const maxTop = viewport.height - MARGIN - size.height;
  const top = clamp(anchor.top, MARGIN, maxTop);
  const right = anchor.left + anchor.width + GAP;
  if (right <= maxLeft) return { left: right, top, side: "right" };
  const left = anchor.left - GAP - size.width;
  if (left >= MARGIN) return { left, top, side: "left" };

  const center = clamp(
    anchor.left + anchor.width / 2 - size.width / 2,
    MARGIN,
    maxLeft,
  );
  const below = anchor.top + anchor.height + GAP;
  const roomBelow = viewport.height - MARGIN - below;
  const roomAbove = anchor.top - GAP - MARGIN;
  if (roomBelow >= size.height || roomBelow >= roomAbove)
    return { left: center, top: clamp(below, MARGIN, maxTop), side: "below" };
  return {
    left: center,
    top: clamp(anchor.top - GAP - size.height, MARGIN, maxTop),
    side: "above",
  };
}
