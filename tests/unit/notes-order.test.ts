import { describe, expect, it } from "vitest";
import { applyPositions, placeItem, sortItems } from "@/lib/notes/order";
import type { NoteItem } from "@/lib/notes/types";

// Spec 048 RF-3, RF-5, plan D1: dropping an item writes one row.
const item = (id: string, position: number, done = false): NoteItem => ({
  id,
  text: id,
  done,
  doneAt: done ? "2026-11-01T00:00:00Z" : null,
  position,
});
const order = (
  items: NoteItem[],
  changes: { id: string; position: number }[],
) => sortItems(applyPositions(items, changes)).map((i) => i.id);

describe("placeItem", () => {
  const items = [item("a", 0), item("b", 1), item("c", 2), item("x", 3, true)];

  it("puts the item between its new neighbours with one row", () => {
    const changes = placeItem(items, "c", 1)!;
    expect(changes).toEqual([{ id: "c", position: 0.5 }]);
    expect(order(items, changes)).toEqual(["a", "c", "b", "x"]);
  });

  it("moves to the end and to the top", () => {
    const last = placeItem(items, "a", 2)!;
    expect(last).toEqual([{ id: "a", position: 3 }]);
    expect(order(items, last)).toEqual(["b", "c", "a", "x"]);
    const top = placeItem([item("a", 2), item("b", 3), item("c", 4)], "c", 0)!;
    expect(top).toEqual([{ id: "c", position: 1 }]);
  });

  it("renumbers the pending ones when there is no room", () => {
    const tight = [item("a", 0), item("b", 0), item("c", 1)];
    const changes = placeItem(tight, "c", 0)!;
    expect(order(tight, changes)).toEqual(["c", "a", "b"]);
    expect(changes.map((c) => c.position)).toEqual([0, 1, 2]);
    const close = [item("a", 1), item("b", 1 + 1e-10), item("c", 2)];
    expect(placeItem(close, "c", 1)!.length).toBe(3);
  });

  it("does nothing for the same place, a done item or an unknown one", () => {
    expect(placeItem(items, "b", 1)).toBeNull();
    expect(placeItem(items, "x", 0)).toBeNull();
    expect(placeItem(items, "zz", 0)).toBeNull();
  });
});
