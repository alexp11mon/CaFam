// Spec 048 RF-13: the note named in the chat, decided by the server, never
// by the model (as matchCalendar, spec 036 plan D1). Pure.
import { normalize } from "@/lib/assistant/calendar-match";

export type NoteMatch<T extends { id: string; title: string }> =
  | { status: "ok"; note: T }
  | { status: "ambiguous"; options: string[] }
  | { status: "not_found"; name: string };

// What people say around a note's name: "la lista de la compra".
const FILLERS = new Set([
  "el",
  "la",
  "los",
  "las",
  "de",
  "del",
  "mi",
  "mis",
  "en",
  "lista",
  "listas",
  "nota",
  "notas",
]);

const significant = (text: string) =>
  normalize(text)
    .filter((word) => !FILLERS.has(word))
    .join(" ");

/** The same words first; then a title that holds what was said. */
export function matchNote<T extends { id: string; title: string }>(
  named: string,
  notes: readonly T[],
): NoteMatch<T> {
  const query = significant(named);
  if (!query) return { status: "not_found", name: named.trim() };
  const titled = notes.filter((note) => significant(note.title));
  const exact = titled.filter((note) => significant(note.title) === query);
  const found = exact.length
    ? exact
    : titled.filter((note) => significant(note.title).includes(query));
  if (found.length === 1) return { status: "ok", note: found[0]! };
  if (found.length > 1) {
    return {
      status: "ambiguous",
      options: found
        .map((note) => note.title)
        .sort((a, b) => a.localeCompare(b, "es")),
    };
  }
  return { status: "not_found", name: named.trim() };
}
