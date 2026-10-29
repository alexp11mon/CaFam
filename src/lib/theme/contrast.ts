// What a translucent surface looks like over what lies behind it, so the
// contrast of text on glass can be measured (spec 011 RF-15, plan D7).
function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** `top` at `alpha` over an opaque `bottom`, as a #RRGGBB color. */
export function composite(top: string, alpha: number, bottom: string): string {
  const under = channels(bottom);
  return `#${channels(top)
    .map((value, i) =>
      Math.round(value * alpha + under[i]! * (1 - alpha))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}
