/** How far past a limit a surface may follow the finger (spec 021 RF-32). */
export const BAND_LIMIT = 64;

/**
 * Past a limit the surface follows less and less and never reaches `max`
 * (spec 021 RF-32, RF-33): increasing, under `max` and with a falling slope.
 */
export function rubberBand(excess: number, max = BAND_LIMIT): number {
  if (excess <= 0) return 0;
  return max * (1 - 1 / (1 + (excess * 0.55) / max));
}

/** `value` unchanged inside [min, max] and banded past either end. */
export function banded(
  value: number,
  min: number,
  max: number,
  limit = BAND_LIMIT,
): number {
  if (value > max) return max + rubberBand(value - max, limit);
  if (value < min) return min - rubberBand(min - value, limit);
  return value;
}
