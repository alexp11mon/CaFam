// The order of the cards and of the items of a list (spec 028 RF-2, RF-6,
// plan D7). Pure.
import type { NoteItem } from "./types";

/** Pinned first; then the latest change first. */
export function sortNotes<
  T extends { pinned: boolean; updatedAt: string; id: string },
>(notes: readonly T[]): T[] {
  return [...notes].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Pending items in their order, then the done ones, the first ticked first:
 * ticking an item takes it down (RF-6).
 */
export function sortItems(items: readonly NoteItem[]): NoteItem[] {
  const byPosition = (a: NoteItem, b: NoteItem) =>
    a.position - b.position || a.id.localeCompare(b.id);
  const pending = items.filter((item) => !item.done).sort(byPosition);
  const done = items
    .filter((item) => item.done)
    .sort(
      (a, b) =>
        (a.doneAt ?? "").localeCompare(b.doneAt ?? "") || byPosition(a, b),
    );
  return [...pending, ...done];
}

/** The position of a new item: after every other. */
export function nextPosition(items: readonly NoteItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
}

/**
 * Swaps a pending item with its neighbour above or below. Returns the two
 * rows to save, or null at the end of the list or for a done item.
 */
export function moveItem(
  items: readonly NoteItem[],
  id: string,
  direction: "up" | "down",
): { id: string; position: number }[] | null {
  const pending = sortItems(items).filter((item) => !item.done);
  const index = pending.findIndex((item) => item.id === id);
  const other = pending[index + (direction === "up" ? -1 : 1)];
  const moved = pending[index];
  if (!moved || !other) return null;
  // Equal positions (never saved in order) would swap into nothing.
  if (moved.position === other.position) {
    return pending.map((item, position) => ({
      id: item.id,
      position:
        item.id === moved.id
          ? pending.indexOf(other)
          : item.id === other.id
            ? index
            : position,
    }));
  }
  return [
    { id: moved.id, position: other.position },
    { id: other.id, position: moved.position },
  ];
}

/** `items` with the new positions of `moveItem`. */
export function applyPositions(
  items: readonly NoteItem[],
  changes: readonly { id: string; position: number }[],
): NoteItem[] {
  const byId = new Map(changes.map((change) => [change.id, change.position]));
  return items.map((item) =>
    byId.has(item.id) ? { ...item, position: byId.get(item.id)! } : item,
  );
}

/** Closer than this, two positions are renumbered (spec 048 plan D1). */
const ROOM = 1e-9;

/**
 * Drops a pending item at `toIndex` of the pending ones (its index once
 * moved). One row with a position between its new neighbours; every pending
 * one renumbered when there is no room. Null when nothing changes.
 */
export function placeItem(
  items: readonly NoteItem[],
  id: string,
  toIndex: number,
): { id: string; position: number }[] | null {
  const pending = sortItems(items).filter((item) => !item.done);
  const from = pending.findIndex((item) => item.id === id);
  if (from < 0) return null;
  const rest = pending.filter((item) => item.id !== id);
  const to = Math.max(0, Math.min(toIndex, rest.length));
  if (to === from) return null;
  const before = rest[to - 1]?.position;
  const after = rest[to]?.position;
  const position =
    before === undefined
      ? after === undefined
        ? 0
        : after >= 1
          ? after - 1
          : after / 2
      : after === undefined
        ? before + 1
        : (before + after) / 2;
  const fits =
    (before === undefined || position - before > ROOM) &&
    (after === undefined || after - position > ROOM);
  if (fits) return [{ id, position }];
  const moved = pending[from];
  rest.splice(to, 0, moved);
  return rest.map((item, index) => ({ id: item.id, position: index }));
}
