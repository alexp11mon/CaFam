/**
 * What the user folded in the calendar lists, remembered on this device
 * (spec 032 RF-6, RF-10, plan D2). Only explicit choices are kept: an id
 * without one takes its default (lists unfolded, categories folded).
 */
export const FOLDED_KEY = "cafam-folded";

/** Few enough to never fill the storage: the oldest choices go first. */
export const FOLDED_MAX = 200;

export type FoldChoices = Readonly<Record<string, boolean>>;

/** Tolerates anything in storage: what is not an id → boolean is dropped. */
export function parseFolded(raw: string | null): FoldChoices {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([id, folded]) => id.length > 0 && typeof folded === "boolean",
      ),
    );
  } catch {
    return {};
  }
}

/** A new choice goes last, so the oldest ones are dropped first. */
export function withChoice(
  choices: FoldChoices,
  id: string,
  folded: boolean,
): FoldChoices {
  const rest = Object.entries(choices).filter(([key]) => key !== id);
  rest.push([id, folded]);
  return Object.fromEntries(rest.slice(-FOLDED_MAX));
}

export function isFolded(
  choices: FoldChoices,
  id: string,
  byDefault = false,
): boolean {
  return choices[id] ?? byDefault;
}

/** The ids the lists share, so folding in one place folds in the other (RF-10). */
export const foldId = {
  calendars: "section:calendars",
  ungrouped: "section:ungrouped",
  group: (id: string) => `group:${id}`,
  person: (id: string) => `person:${id}`,
  categories: (calendarId: string) => `categories:${calendarId}`,
};
