// What the interface offers for a note (spec 028 RF-8, RF-10). The database
// enforces it with RLS whatever this says (P3).
import type { Note } from "./types";

export type NoteRole = "owner" | "editor" | "viewer" | null;

export interface NoteAccess {
  /** Change the note and its items. */
  canWrite: boolean;
  canDelete: boolean;
  /** Link it to a calendar or make it personal: only its author. */
  canMove: boolean;
  /** Why it is read-only, or null. */
  readOnlyReason: string | null;
}

export function noteAccess(
  note: Pick<Note, "ownerId" | "calendarId" | "calendarName">,
  userId: string,
  /** The user's role in the note's calendar; null for a personal note. */
  role: NoteRole,
): NoteAccess {
  const mine = note.ownerId === userId;
  if (!note.calendarId) {
    return {
      canWrite: mine,
      canDelete: mine,
      canMove: mine,
      readOnlyReason: null,
    };
  }
  const canWrite = role === "owner" || role === "editor";
  return {
    canWrite,
    canDelete: role === "owner" || (mine && role === "editor"),
    canMove: mine && canWrite,
    readOnlyReason: canWrite
      ? null
      : `Solo lectura: eres Lector de «${note.calendarName ?? "este calendario"}».`,
  };
}
