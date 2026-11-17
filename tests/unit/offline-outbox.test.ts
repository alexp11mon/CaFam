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
