export type NoteKind = "list" | "text";

export interface NoteItem {
  id: string;
  text: string;
  done: boolean;
  /** When it was ticked, as the database says; null while pending. */
  doneAt: string | null;
  position: number;
}

export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  body: string;
  color: string | null;
  pinned: boolean;
  archived: boolean;
  /** YYYY-MM-DD or null. */
  dueDate: string | null;
  updatedAt: string;
  /** Null once its author left the calendar or deleted the account. */
  ownerId: string | null;
  /** Null = personal. */
  calendarId: string | null;
  calendarName: string | null;
  items: NoteItem[];
}
