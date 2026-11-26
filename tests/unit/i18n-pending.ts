// Spec 053 T2: what the English catalog leaves out on purpose, and what is
// still to migrate (must end empty).

/** Spanish that people never see in the interface. */
export const NOT_SHOWN = [
  // The natural-language parser understands only Spanish (RF-5).
  "src/lib/nl/",
  // Model-facing instructions and tool descriptions (the prompt sets the language).
  "src/lib/assistant/prompt.ts",
  "src/lib/assistant/tool-definitions.ts",
  // Model-facing texts of the assistant (dates in its context, loop notes).
  "src/lib/assistant/dates.ts",
  "src/lib/assistant/run.ts",
  // Internal errors and the accent folding of search, never shown.
  "src/app/api/assistant/route.ts",
  "src/lib/sync/deps.ts",
  "src/lib/sync/icloud-ics.ts",
  "src/lib/sync/providers/",
  "src/lib/search/normalize.ts",
  // The README of "Descargar mis datos" stays in Spanish, like the file names.
  "src/lib/export/account-files.ts",
  // The catalog itself.
  "src/i18n/",
];

export const PENDING = new Set<string>([]);
