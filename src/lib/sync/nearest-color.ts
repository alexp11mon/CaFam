import {
  CALENDAR_COLORS,
  DEFAULT_CALENDAR_COLOR,
} from "@/lib/calendar/palette";

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** The palette color closest to the provider's one (RF-10, plan D16). */
export function nearestColor(hex: string | null | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return DEFAULT_CALENDAR_COLOR;

  const [r, g, b] = rgb(hex);
  let best = DEFAULT_CALENDAR_COLOR;
  let bestDistance = Infinity;
  for (const { value } of CALENDAR_COLORS) {
    const [pr, pg, pb] = rgb(value);
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestDistance) {
      best = value;
      bestDistance = d;
    }
  }
  return best;
}
