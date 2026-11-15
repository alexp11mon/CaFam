// Searching the notes as the user types (spec 028 RF-2). Pure.
import type { Note } from "./types";

/** Lower case and without accents: "Médico" matches "medico". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Every word of the query is in the title, the body or an item. */
export function matchesNote(note: Note, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = normalize(
    [note.title, note.body, ...note.items.map((item) => item.text)].join("\n"),
  );
  return words.every((word) => text.includes(word));
}

export type NoteFilter = "all" | "list" | "text" | "archived";

/** Archived notes only show under their own filter. */
export function filterNotes(
  notes: readonly Note[],
  filter: NoteFilter,
  query: string,
): Note[] {
  return notes.filter(
    (note) =>
      (filter === "archived"
        ? note.archived
        : !note.archived && (filter === "all" || note.kind === filter)) &&
      matchesNote(note, query),
  );
}
