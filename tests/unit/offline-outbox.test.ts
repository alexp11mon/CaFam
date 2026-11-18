import { describe, expect, it } from "vitest";
import type { EventData } from "@/lib/calendar/schemas";
import {
  dependentsOf,
  enqueue,
  withoutChange,
  type OfflineChange,
  type OutboxEntry,
} from "@/lib/offline/outbox";

const data = (title: string): EventData => ({
  title,
  calendarId: "cal",
  allDay: false,
  startsAt: "2026-11-20T09:00:00Z",
  endsAt: "2026-11-20T10:00:00Z",
  description: null,
  location: null,
  color: null,
  categoryId: null,
});

let n = 0;
const entry = (change: OfflineChange): OutboxEntry => ({
  changeId: `c${++n}`,
  createdAt: "2026-11-17T10:00:00Z",
  change,
});

const build = (...changes: OfflineChange[]) =>
  changes.reduce<OutboxEntry[]>(
    (queue, change) => enqueue(queue, entry(change)),
    [],
  );

const noteBase = {
  title: "Compra",
  body: "",
  color: null,
  pinned: false,
  archived: false,
  dueDate: null,
};

describe("enqueue (spec 034 RF-40, RF-42, RF-43)", () => {
  it("keeps different things in the order they were made", () => {
    const queue = build(
      { type: "event.update", id: "a", base: data("A"), data: data("A2") },
      { type: "event.create", id: "b", data: data("B") },
    );
    expect(queue.map((e) => e.change.type)).toEqual([
      "event.update",
      "event.create",
    ]);
  });

  it("merges updates: the base of the first, the data of the last", () => {
    const [only, ...rest] = build(
      { type: "event.update", id: "a", base: data("A"), data: data("A2") },
      { type: "event.update", id: "a", base: data("A2"), data: data("A3") },
    );
    expect(rest).toEqual([]);
    expect(only?.change).toMatchObject({
      type: "event.update",
      base: { title: "A" },
      data: { title: "A3" },
    });
  });

  it("turns create + update into one create", () => {
    const queue = build(
      { type: "event.create", id: "b", data: data("B") },
      { type: "event.update", id: "b", base: data("B"), data: data("B2") },
    );
    expect(queue).toHaveLength(1);
    expect(queue[0]?.change).toMatchObject({
      type: "event.create",
      data: { title: "B2" },
    });
  });

  it("drops an event created and deleted offline", () => {
    expect(
      build(
        { type: "event.create", id: "b", data: data("B") },
        { type: "event.delete", id: "b", base: data("B") },
      ),
    ).toEqual([]);
  });

  it("turns update + delete into a delete with the first base", () => {
    const queue = build(
      { type: "event.update", id: "a", base: data("A"), data: data("A2") },
      { type: "event.delete", id: "a", base: data("A2") },
    );
    expect(queue.map((e) => e.change)).toEqual([
      { type: "event.delete", id: "a", base: data("A") },
    ]);
  });

  it("drops a note created and deleted offline with its items", () => {
    expect(
      build(
        {
          type: "note.create",
          id: "n",
          kind: "list",
          calendarId: null,
          fields: {},
        },
        {
          type: "item.add",
          noteId: "n",
          id: "i",
          text: "Pan",
          position: 0,
          done: false,
        },
        { type: "note.delete", id: "n", base: noteBase },
      ),
    ).toEqual([]);
  });

  it("folds item changes into their add, and add + delete into nothing", () => {
    const queue = build(
      {
        type: "item.add",
        noteId: "n",
        id: "i",
        text: "Pan",
        position: 0,
        done: false,
      },
      {
        type: "item.update",
        noteId: "n",
        id: "i",
        base: { text: "Pan", done: false },
        change: { done: true },
      },
    );
    expect(queue.map((e) => e.change)).toMatchObject([
      { type: "item.add", text: "Pan", done: true },
    ]);
    expect(
      build(
        {
          type: "item.add",
          noteId: "n",
          id: "i",
          text: "Pan",
          position: 0,
          done: false,
        },
        {
          type: "item.delete",
          noteId: "n",
          id: "i",
          base: { text: "Pan", done: false },
        },
      ),
    ).toEqual([]);
  });

  it("keeps only the last order of a list", () => {
    const queue = build(
      { type: "item.move", noteId: "n", positions: [{ id: "i", position: 1 }] },
      { type: "item.move", noteId: "n", positions: [{ id: "i", position: 2 }] },
    );
    expect(queue.map((e) => e.change)).toEqual([
      { type: "item.move", noteId: "n", positions: [{ id: "i", position: 2 }] },
    ]);
  });

  it("merges note fields into the note created offline", () => {
    const queue = build(
      {
        type: "note.create",
        id: "n",
        kind: "text",
        calendarId: null,
        fields: { title: "T" },
      },
      {
        type: "note.update",
        id: "n",
        base: noteBase,
        fields: { body: "Hola" },
      },
    );
    expect(queue.map((e) => e.change)).toEqual([
      {
        type: "note.create",
        id: "n",
        kind: "text",
        calendarId: null,
        fields: { title: "T", body: "Hola" },
      },
    ]);
  });
});

describe("withoutChange (RF-30)", () => {
  it("takes one change out by its id", () => {
    const queue = build({ type: "event.create", id: "b", data: data("B") });
    expect(withoutChange(queue, queue[0]!.changeId)).toEqual([]);
  });
});

describe("dependentsOf (RF-49)", () => {
  it("lists the later changes of the same thing and the items of a refused note", () => {
    const queue = build(
      {
        type: "note.create",
        id: "n",
        kind: "list",
        calendarId: "cal",
        fields: {},
      },
      { type: "event.create", id: "e", data: data("E") },
      {
        type: "item.add",
        noteId: "n",
        id: "i",
        text: "Pan",
        position: 0,
        done: false,
      },
      { type: "item.move", noteId: "n", positions: [{ id: "i", position: 0 }] },
    );
    expect(dependentsOf(queue, queue[0]!).map((e) => e.change.type)).toEqual([
      "item.add",
      "item.move",
    ]);
    expect(dependentsOf(queue, queue[1]!)).toEqual([]);
  });
});

// Spec 035 T1: series, comments and images in the same queue.
const seriesBase = {
  fields: data("Clase"),
  recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
  exdates: [],
  totals: { exceptions: 0, images: 0, comments: 0, latest: null },
};
const SERIES = "11111111-1111-1111-1111-111111111111";

describe("enqueue with comments, images and series (spec 035)", () => {
  it("sends one comment with the last text when it was added and edited (RF-19)", () => {
    const queue = build(
      { type: "comment.add", eventId: "e", clientId: "k", body: "Hola" },
      {
        type: "comment.update",
        id: "k",
        eventId: "e",
        base: { body: "Hola" },
        body: "Hola a todos",
      },
    );
    expect(queue.map((e) => e.change)).toEqual([
      {
        type: "comment.add",
        eventId: "e",
        clientId: "k",
        body: "Hola a todos",
      },
    ]);
  });

  it("sends nothing for a comment added and then deleted (RF-19)", () => {
    const queue = build(
      { type: "comment.add", eventId: "e", clientId: "k", body: "Hola" },
      { type: "comment.delete", id: "k", eventId: "e", base: { body: "Hola" } },
    );
    expect(queue).toEqual([]);
  });

  it("keeps the first base of a saved comment edited and then deleted", () => {
    const edited = build(
      {
        type: "comment.update",
        id: "c",
        eventId: "e",
        base: { body: "A" },
        body: "B",
      },
      {
        type: "comment.update",
        id: "c",
        eventId: "e",
        base: { body: "B" },
        body: "C",
      },
    );
    expect(edited.map((e) => e.change)).toEqual([
      {
        type: "comment.update",
        id: "c",
        eventId: "e",
        base: { body: "A" },
        body: "C",
      },
    ]);
    const deleted = enqueue(
      edited,
      entry({
        type: "comment.delete",
        id: "c",
        eventId: "e",
        base: { body: "C" },
      }),
    );
    expect(deleted.map((e) => e.change)).toEqual([
      { type: "comment.delete", id: "c", eventId: "e", base: { body: "A" } },
    ]);
  });

  it("sends nothing for an image added and then taken out (RF-32)", () => {
    const queue = build(
      { type: "image.add", eventId: "e", localId: "l" },
      { type: "image.delete", id: "l", eventId: "e" },
    );
    expect(queue).toEqual([]);
  });

  it("merges two changes of the same series with the same scope (RF-11)", () => {
    const queue = build(
      {
        type: "series.update",
        id: "s",
        scope: "all",
        base: seriesBase,
        data: data("Clase 2"),
        repeat: "weekly",
      },
      {
        type: "series.update",
        id: "s",
        scope: "all",
        base: { ...seriesBase, fields: data("Clase 2") },
        data: data("Clase 3"),
        repeat: "daily",
      },
    );
    expect(queue.map((e) => e.change)).toEqual([
      {
        type: "series.update",
        id: "s",
        scope: "all",
        base: seriesBase,
        data: data("Clase 3"),
        repeat: "daily",
      },
    ]);
  });

  it("keeps two changes of the same series with different scopes", () => {
    const queue = build(
      {
        type: "series.update",
        id: "s",
        scope: "this",
        base: seriesBase,
        data: data("X"),
        repeat: "weekly",
      },
      { type: "series.delete", id: "s", scope: "following", base: seriesBase },
    );
    expect(queue).toHaveLength(2);
  });

  it("deleting an event takes its pending comments and images (RF-23, RF-36)", () => {
    const queue = build(
      { type: "comment.add", eventId: "e", clientId: "k", body: "Hola" },
      { type: "image.add", eventId: "e", localId: "l" },
      { type: "comment.add", eventId: "f", clientId: "m", body: "Otro" },
      { type: "event.delete", id: "e", base: data("E") },
    );
    expect(queue.map((e) => e.change.type)).toEqual([
      "comment.add",
      "event.delete",
    ]);
    expect(queue[0]!.change).toMatchObject({ eventId: "f" });
  });

  it("deleting a whole series takes the pending changes of its occurrences", () => {
    const queue = build(
      {
        type: "comment.add",
        eventId: `${SERIES}_20261123T090000Z`,
        clientId: "k",
        body: "Hola",
      },
      { type: "series.delete", id: SERIES, scope: "all", base: seriesBase },
    );
    expect(queue.map((e) => e.change.type)).toEqual(["series.delete"]);
  });

  it("a refused event takes its comments and images with it (RF-22)", () => {
    const queue = build(
      { type: "event.create", id: "e", data: data("E") },
      { type: "comment.add", eventId: "e", clientId: "k", body: "Hola" },
      { type: "image.add", eventId: "e", localId: "l" },
      { type: "comment.add", eventId: "f", clientId: "m", body: "Otro" },
    );
    expect(dependentsOf(queue, queue[0]!).map((e) => e.change.type)).toEqual([
      "comment.add",
      "image.add",
    ]);
  });

  it("a create with a rule keeps the last rule when edited (RF-11)", () => {
    const queue = build(
      { type: "event.create", id: "e", data: data("E"), repeat: "weekly" },
      {
        type: "event.update",
        id: "e",
        base: data("E"),
        data: data("E2"),
        repeat: "daily",
      },
    );
    expect(queue.map((e) => e.change)).toEqual([
      { type: "event.create", id: "e", data: data("E2"), repeat: "daily" },
    ]);
  });
});
