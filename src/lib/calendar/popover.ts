export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
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
