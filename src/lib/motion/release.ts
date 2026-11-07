/** A flick this fast (px/ms) counts even under the distance threshold (RF-25). */
export const FLICK_SPEED = 0.5;

/** Px before a gesture picks its axis (spec 021 RF-27). */
export const AXIS_SLOP = 10;

export type Release = "forward" | "back" | "stay";

/**
 * What a released drag does (spec 021 RF-25, RF-28, RF-29): a drag towards the
 * start (negative) moves forward, towards the end moves back, and a short,
 * slow one returns.
 */
export function releaseDecision({
  delta,
  velocity,
  threshold,
  speed = FLICK_SPEED,
}: {
  delta: number;
  velocity: number;
  threshold: number;
  speed?: number;
}): Release {
  if (delta <= -threshold || velocity <= -speed) return "forward";
  if (delta >= threshold || velocity >= speed) return "back";
  return "stay";
}

/** The axis of a gesture once it moved `slop` px, or null before (RF-27). */
export function lockAxis(
  dx: number,
  dy: number,
  slop = AXIS_SLOP,
): "x" | "y" | null {
  if (Math.hypot(dx, dy) < slop) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

const WINDOW = 100;

/** The pointer speed at release, from the samples of the last 100 ms. */
export function trackVelocity() {
  let samples: { position: number; time: number }[] = [];
  return {
    add(position: number, time: number) {
      samples.push({ position, time });
      samples = samples.filter((s) => s.time >= time - WINDOW);
    },
    velocity(): number {
      if (samples.length < 2) return 0;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const elapsed = last.time - first.time;
      return elapsed > 0 ? (last.position - first.position) / elapsed : 0;
    },
  };
}
