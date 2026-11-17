import { describe, expect, it } from "vitest";
import type { EventData } from "@/lib/calendar/schemas";
import type { Note } from "@/lib/notes/types";
import type { OfflineChange, OutboxEntry } from "@/lib/offline/outbox";
import { pendingEvents, pendingNotes } from "@/lib/offline/overlay";
import type { OfflineEvent } from "@/lib/offline/snapshot";

const NOW = "2026-11-17T12:00:00Z";

const event = (id: string, startsAt: string): OfflineEvent => ({
  id,
  calendarId: "cal",
  title: id,
  startsAt,
  endsAt: startsAt,
  allDay: false,
  color: null,
  categoryId: null,
  location: null,
  imageCount: 2,
  commentCount: 0,
  seriesId: null,
  description: "Detalle",
  createdBy: "u",
  createdByName: "Ana",
  seriesSummary: null,
  seriesChanged: false,
});

const data = (title: string, startsAt: string): EventData => ({
  title,
  calendarId: "cal",
  allDay: false,
  startsAt,
  endsAt: startsAt,
  description: null,
  location: "Casa",
  color: "#FFADAD",
  categoryId: null,
});

const queue = (...changes: OfflineChange[]): OutboxEntry[] =>
  changes.map((change, i) => ({ changeId: `c${i}`, createdAt: NOW, change }));

describe("pendingEvents (spec 034 RF-26, RF-28)", () => {
  const copy = [
    event("a", "2026-11-20T09:00:00Z"),
    event("b", "2026-11-21T09:00:00Z"),
    event("s_20261122T090000Z", "2026-11-22T09:00:00Z"),
  ];

  it("leaves the copy as it is without changes", () => {
    expect(pendingEvents(copy, [])).toEqual(copy);
  });

  it("applies creates, updates and deletes, and marks them", () => {
    const result = pendingEvents(
      copy,
      queue(
        {
          type: "event.create",
          id: "new",
          data: data("Nuevo", "2026-11-19T09:00:00Z"),
        },
        {
          type: "event.update",
          id: "a",
          base: data("a", "2026-11-20T09:00:00Z"),
          data: data("Movido", "2026-11-23T09:00:00Z"),
        },
        {
          type: "event.delete",
          id: "b",
          base: data("b", "2026-11-21T09:00:00Z"),
        },
      ),
    );
    expect(result.map((e) => [e.id, e.title, e.pending ?? false])).toEqual([
      ["new", "Nuevo", true],
      ["s_20261122T090000Z", "s_20261122T090000Z", false],
      ["a", "Movido", true],
    ]);
    // What the change does not carry stays (images of the copy).
    expect(result.find((e) => e.id === "a")?.imageCount).toBe(2);
  });

  it("changes one occurrence of a series by its id", () => {
    const [, , occurrence] = pendingEvents(
      copy,
      queue({
        type: "event.update",
        id: "s_20261122T090000Z",
        base: data("s", "2026-11-22T09:00:00Z"),
        data: data("Solo esta", "2026-11-22T09:00:00Z"),
      }),
    );
    expect(occurrence).toMatchObject({ title: "Solo esta", pending: true });
  });
});

const note = (id: string, items: Note["items"] = []): Note => ({
  id,
  kind: "list",
  title: "Compra",
  body: "",
  color: null,
  pinned: false,
  archived: false,
  dueDate: null,
  updatedAt: "2026-11-10T10:00:00Z",
  ownerId: "u",
  calendarId: null,
  calendarName: null,
  items,
});

describe("pendingNotes (RF-37)", () => {
  const items = [
    { id: "i1", text: "Pan", done: false, doneAt: null, position: 0 },
    { id: "i2", text: "Leche", done: false, doneAt: null, position: 1 },
  ];

  it("applies note and item changes and marks the note", () => {
    const [result] = pendingNotes(
      [note("n", items)],
      queue(
        {
          type: "note.update",
          id: "n",
          base: {
            title: "Compra",
            body: "",
            color: null,
            pinned: false,
            archived: false,
            dueDate: null,
          },
          fields: { pinned: true },
        },
        {
          type: "item.update",
          noteId: "n",
          id: "i1",
          base: { text: "Pan", done: false },
          change: { done: true },
        },
        {
          type: "item.add",
          noteId: "n",
          id: "i3",
          text: "Huevos",
          position: 2,
          done: false,
        },
        {
          type: "item.delete",
          noteId: "n",
          id: "i2",
          base: { text: "Leche", done: false },
        },
        {
          type: "item.move",
          noteId: "n",
          positions: [
            { id: "i3", position: 0 },
            { id: "i1", position: 1 },
          ],
        },
      ),
      NOW,
    );
    expect(result).toMatchObject({
      pinned: true,
      pending: true,
      updatedAt: NOW,
    });
    expect(result?.items.map((i) => [i.id, i.done, i.position])).toEqual([
      ["i3", false, 0],
      ["i1", true, 1],
    ]);
    expect(result?.items[1]?.doneAt).toBe(NOW);
  });

  it("adds a note created offline and removes a deleted one", () => {
    const result = pendingNotes(
      [note("old")],
      queue(
        {
          type: "note.create",
          id: "n",
          kind: "text",
          calendarId: null,
          fields: { title: "Idea" },
        },
        {
          type: "note.delete",
          id: "old",
          base: {
            title: "Compra",
            body: "",
            color: null,
            pinned: false,
            archived: false,
            dueDate: null,
          },
        },
      ),
      NOW,
    );
    expect(result.map((n) => [n.id, n.title, n.pending])).toEqual([
      ["n", "Idea", true],
    ]);
  });
});
