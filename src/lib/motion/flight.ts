import type { Box } from "@/lib/calendar/popover";

/** Trips shorter than this go straight (spec 021 RF-22). */
const ARC_FROM = 48;
const ARC_MAX = 32;

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

/**
 * Keyframes of `translate` that bring an element drawn at `to` back from
 * `from` along a gentle upward arc (spec 021 RF-20..RF-22): the arc bulges
 * min(32, distance / 4) px, and trips under 48 px go straight.
 */
export function flightKeyframes(from: Box, to: Box, steps = 8): Keyframe[] {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const distance = Math.hypot(dx, dy);
  const arc = distance >= ARC_FROM ? Math.min(ARC_MAX, distance / 4) : 0;
  // The normal to the trip that points up the screen.
  let nx = distance ? -dy / distance : 0;
  let ny = distance ? dx / distance : 0;
  if (ny > 0) [nx, ny] = [-nx, -ny];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const bulge = arc * Math.sin(Math.PI * t);
    return {
      translate: `${px((1 - t) * dx + bulge * nx)} ${px((1 - t) * dy + bulge * ny)}`,
    };
  });
}
