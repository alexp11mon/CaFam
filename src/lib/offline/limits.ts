// The limits of notes checked on the copy before a change made offline
// (spec 034 RF-36); the database checks them again when it is sent.
import { NOTE_MESSAGES } from "@/lib/notes/error-messages";
import { ITEMS_MAX, NOTES_MAX } from "@/lib/notes/limits";
import type { Note } from "@/lib/notes/types";

/** The message that refuses a new note of `userId`, or null. */
export function newNoteError(
  notes: readonly Note[],
  userId: string,
): string | null {
  const own = notes.filter((note) => note.ownerId === userId).length;
  return own >= NOTES_MAX ? NOTE_MESSAGES.tooManyNotes : null;
}

/** The message that refuses one more item in `note`, or null. */
export function newItemError(note: Pick<Note, "items">): string | null {
  return note.items.length >= ITEMS_MAX ? NOTE_MESSAGES.tooManyItems : null;
}
