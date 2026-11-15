import { describe, expect, it } from "vitest";
import { getNoteErrorMessage } from "@/lib/notes/error-messages";
import {
  applyPositions,
  moveItem,
  nextPosition,
  sortItems,
  sortNotes,
} from "@/lib/notes/order";
import { noteAccess } from "@/lib/notes/permissions";
import { dueLabel, progress } from "@/lib/notes/progress";
import {
  createNoteSchema,
  itemTextSchema,
  noteFieldsSchema,
} from "@/lib/notes/schemas";
import { filterNotes, matchesNote, normalize } from "@/lib/notes/search";
import type { Note, NoteItem } from "@/lib/notes/types";

// Spec 028, T2: the pure logic of notes.
const item = (
  id: string,
  position: number,
  done = false,
  doneAt: string | null = null,
): NoteItem => ({ id, text: id, done, doneAt, position });

const note = (over: Partial<Note> = {}): Note => ({
  id: "n1",
  kind: "list",
  title: "Compra",
  body: "",
  color: null,
  pinned: false,
  archived: false,
  dueDate: null,
  updatedAt: "2026-11-15T10:00:00Z",
  ownerId: "me",
  calendarId: null,
  calendarName: null,
  items: [],
  ...over,
});

describe("order", () => {
  it("puts the pinned notes first, then the latest change", () => {
    const sorted = sortNotes([
      note({ id: "old", updatedAt: "2026-11-01T00:00:00Z" }),
      note({ id: "new", updatedAt: "2026-11-15T00:00:00Z" }),
      note({ id: "pin", pinned: true, updatedAt: "2026-10-01T00:00:00Z" }),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(["pin", "new", "old"]);
  });

  it("takes the done items down, the first ticked first (RF-6)", () => {
    const sorted = sortItems([
      item("b", 1),
      item("done-late", 0, true, "2026-11-15T12:00:00Z"),
      item("a", 0),
      item("done-early", 5, true, "2026-11-15T09:00:00Z"),
    ]);
    expect(sorted.map((i) => i.id)).toEqual([
      "a",
      "b",
      "done-early",
      "done-late",
    ]);
  });

  it("adds after every other item", () => {
    expect(nextPosition([])).toBe(0);
    expect(nextPosition([item("a", 3), item("b", 7, true)])).toBe(8);
  });

  it("swaps an item with its pending neighbour and nothing at the ends", () => {
    const items = [
      item("a", 0),
      item("b", 1),
      item("x", 2, true),
      item("c", 3),
    ];
    expect(moveItem(items, "b", "up")).toEqual([
      { id: "b", position: 0 },
      { id: "a", position: 1 },
    ]);
    // Over the done one, straight to the next pending.
    const down = moveItem(items, "b", "down")!;
    expect(down).toEqual([
      { id: "b", position: 3 },
      { id: "c", position: 1 },
    ]);
    expect(sortItems(applyPositions(items, down)).map((i) => i.id)).toEqual([
      "a",
      "c",
      "b",
      "x",
    ]);
    expect(moveItem(items, "a", "up")).toBeNull();
    expect(moveItem(items, "c", "down")).toBeNull();
    expect(moveItem(items, "x", "up")).toBeNull();
  });

  it("gives every item its own position when two shared one", () => {
    const items = [item("a", 0), item("b", 0), item("c", 0)];
    const changes = moveItem(items, "b", "down")!;
    expect(sortItems(applyPositions(items, changes)).map((i) => i.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});

describe("search", () => {
  it("ignores case and accents", () => {
    expect(normalize("  Médico Ñu ")).toBe("medico nu");
    const shopping = note({
      title: "Compra",
      items: [item("Plátanos", 0), item("pan", 1)],
    });
    expect(matchesNote(shopping, "platanos")).toBe(true);
    expect(matchesNote(shopping, "COMPRA pan")).toBe(true);
    expect(matchesNote(shopping, "compra leche")).toBe(false);
    expect(
      matchesNote(note({ kind: "text", body: "Llamar al médico" }), "medico"),
    ).toBe(true);
    expect(matchesNote(shopping, "   ")).toBe(true);
  });

  it("keeps the archived notes under their own filter", () => {
    const notes = [
      note({ id: "list" }),
      note({ id: "text", kind: "text" }),
      note({ id: "old", archived: true }),
    ];
    const ids = (filter: Parameters<typeof filterNotes>[1], query = "") =>
      filterNotes(notes, filter, query).map((n) => n.id);
    expect(ids("all")).toEqual(["list", "text"]);
    expect(ids("list")).toEqual(["list"]);
    expect(ids("text")).toEqual(["text"]);
    expect(ids("archived")).toEqual(["old"]);
    expect(ids("all", "nada")).toEqual([]);
  });
});

describe("progress and due date", () => {
  it("counts what is done", () => {
    expect(progress([])).toMatchObject({
      label: "Sin elementos",
      complete: false,
    });
    expect(progress([item("a", 0, true), item("b", 1)])).toMatchObject({
      done: 1,
      total: 2,
      label: "1 de 2",
      complete: false,
    });
    expect(progress([item("a", 0, true)]).complete).toBe(true);
  });

  it("says when a note is due, and when it is late", () => {
    expect(dueLabel(null, "2026-11-15")).toBeNull();
    expect(dueLabel("2026-11-15", "2026-11-15")).toEqual({
      text: "Para hoy",
      late: false,
    });
    expect(dueLabel("2026-11-19", "2026-11-15")).toEqual({
      text: "Para el jueves, 19 de noviembre",
      late: false,
    });
    expect(dueLabel("2026-11-10", "2026-11-15")).toEqual({
      text: "Venció el martes, 10 de noviembre",
      late: true,
    });
  });
});

describe("what a note offers (RF-8, RF-10)", () => {
  it("a personal note is all its author's", () => {
    expect(noteAccess(note(), "me", null)).toEqual({
      canWrite: true,
      canDelete: true,
      canMove: true,
      readOnlyReason: null,
    });
  });

  const shared = note({
    calendarId: "c1",
    calendarName: "Casa",
    ownerId: "ana",
  });

  it("a viewer only reads a shared note, and is told why", () => {
    expect(noteAccess(shared, "me", "viewer")).toEqual({
      canWrite: false,
      canDelete: false,
      canMove: false,
      readOnlyReason: "Solo lectura: eres Lector de «Casa».",
    });
  });

  it("an editor writes; only the author moves or deletes; the owner deletes", () => {
    expect(noteAccess(shared, "me", "editor")).toMatchObject({
      canWrite: true,
      canDelete: false,
      canMove: false,
    });
    expect(noteAccess(shared, "ana", "editor")).toMatchObject({
      canWrite: true,
      canDelete: true,
      canMove: true,
    });
    expect(noteAccess(shared, "me", "owner")).toMatchObject({
      canWrite: true,
      canDelete: true,
      canMove: false,
    });
    // Its author, now a viewer, cannot change it.
    expect(noteAccess(shared, "ana", "viewer").canWrite).toBe(false);
  });
});

describe("validation, in Spanish (RF-13)", () => {
  const ID = "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11";

  it("accepts a new note and trims its title", () => {
    const parsed = createNoteSchema.parse({
      id: ID,
      kind: "list",
      title: "  Deberes ",
      calendarId: null,
    });
    expect(parsed.title).toBe("Deberes");
    expect(
      createNoteSchema.safeParse({
        id: ID,
        kind: "audio",
        title: "",
        calendarId: null,
      }).success,
    ).toBe(false);
    expect(
      createNoteSchema.safeParse({
        id: ID,
        kind: "text",
        title: "x".repeat(101),
        calendarId: null,
      }).error?.issues[0]?.message,
    ).toBe("El título puede tener 100 caracteres como mucho.");
  });

  it("refuses an empty or too long item", () => {
    expect(itemTextSchema.safeParse("   ").error?.issues[0]?.message).toBe(
      "Escribe algo para añadirlo.",
    );
    expect(itemTextSchema.safeParse("x".repeat(301)).success).toBe(false);
    expect(itemTextSchema.parse(" Pan ")).toBe("Pan");
  });

  it("changes only what is sent, with a palette color and a real date", () => {
    expect(noteFieldsSchema.parse({ pinned: true })).toEqual({ pinned: true });
    expect(noteFieldsSchema.safeParse({}).success).toBe(false);
    expect(noteFieldsSchema.safeParse({ color: "#123456" }).success).toBe(
      false,
    );
    expect(noteFieldsSchema.safeParse({ color: "#A0C4FF" }).success).toBe(true);
    expect(noteFieldsSchema.safeParse({ color: null }).success).toBe(true);
    expect(noteFieldsSchema.safeParse({ dueDate: "2026-02-30" }).success).toBe(
      false,
    );
    expect(noteFieldsSchema.safeParse({ dueDate: "2026-11-19" }).success).toBe(
      true,
    );
  });
});

describe("database errors, in Spanish (RF-13)", () => {
  it("names each limit", () => {
    expect(getNoteErrorMessage({ code: "CF429", message: "notes" })).toContain(
      "500 notas",
    );
    expect(getNoteErrorMessage({ code: "CF429", message: "items" })).toContain(
      "200 elementos",
    );
    expect(getNoteErrorMessage({ code: "42501" })).toContain("permiso");
    expect(getNoteErrorMessage({ code: "22023" })).toContain("revisa");
    expect(getNoteErrorMessage(null)).toContain("conectar");
  });
});
