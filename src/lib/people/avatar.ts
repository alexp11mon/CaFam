// People drawn as initials on a pale tint of their own (spec 005 RF-27,
// RF-28; plan avatars, D11). There are no profile photos.

/** Six pale tints 60 degrees of hue apart; ink on each stays above 10:1. */
export const PERSON_TINTS = [
  "#EDC7C0",
  "#E5EDC0",
  "#C0EDC7",
  "#C0E5ED",
  "#C7C0ED",
  "#EDC0E5",
] as const;

/** First visible character of up to two words: "Ana López" → "AL". */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    // Array.from keeps a character outside the BMP in one piece.
    .map((word) => Array.from(word)[0]!.toLocaleUpperCase("es-ES"));
  return letters.length > 0 ? letters.join("") : "?";
}

/**
 * Tint of each person, assigned in id order so it is the same on every screen
 * and device, and no tint repeats before the seventh person (plan D11).
 */
export function assignTints(personIds: readonly string[]): Map<string, string> {
  const sorted = [...new Set(personIds)].sort();
  return new Map(
    sorted.map((id, index) => [id, PERSON_TINTS[index % PERSON_TINTS.length]!]),
  );
}
