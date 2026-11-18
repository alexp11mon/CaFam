import { describe, expect, it } from "vitest";
import { ITEMS_MAX, NOTES_MAX } from "@/lib/notes/limits";
import type { Note } from "@/lib/notes/types";
import { newItemError, newNoteError } from "@/lib/offline/limits";
import { pendingNotes } from "@/lib/offline/overlay";

const note = (ownerId: string | null, id = crypto.randomUUID()): Note => ({
  id,
  kind: "list",
  title: "",
  body: "",
  color: null,
  pinned: false,
  archived: false,
  dueDate: null,
  updatedAt: "2026-11-10T10:00:00Z",
  ownerId,
  calendarId: null,
  calendarName: null,
  items: [],
});

describe("offline limits of notes (spec 034 RF-36)", () => {
  it("refuses the note after the author's 500th, others' notes apart", () => {
    const mine = Array.from({ length: NOTES_MAX - 1 }, () => note("me"));
    expect(newNoteError([...mine, note("other")], "me")).toBeNull();
    expect(newNoteError([...mine, note("me")], "me")).toMatch(/máximo de 500/);
  });

  it("counts the notes created offline as the user's", () => {
    const mine = Array.from({ length: NOTES_MAX - 1 }, () => note("me"));
    const notes = pendingNotes(
      mine,
      [
        {
          changeId: "c",
          createdAt: "2026-11-17T10:00:00Z",
          change: {
            type: "note.create",
            id: "n",
            kind: "list",
            calendarId: null,
            fields: {},
          },
        },
      ],
      "2026-11-17T10:00:00Z",
      "me",
    );
    expect(newNoteError(notes, "me")).not.toBeNull();
  });

  it("refuses the item after 200", () => {
    const items = Array.from({ length: ITEMS_MAX }, (_, i) => ({
      id: String(i),
      text: "x",
      done: false,
      doneAt: null,
      position: i,
    }));
    expect(newItemError({ items: items.slice(1) })).toBeNull();
    expect(newItemError({ items })).toMatch(/200 elementos/);
  });
});
