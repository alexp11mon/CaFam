// Sliding a finger sideways changes the period, as in Google Calendar (spec 016 RF-25..RF-27).

export const SWIPE_MIN_PX = 50;

/** Left goes forward, right goes back; short or mostly vertical slides do nothing. */
export function swipeDirection(
  dx: number,
  dy: number,
): "next" | "previous" | null {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? "next" : "previous";
}
