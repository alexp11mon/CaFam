// The queue of changes made without a connection (spec 034 RF-27, RF-40,
// RF-42, RF-43, RF-49; plan "Modelo de datos", D10). Pure: the store keeps
// the result, `flush` sends it.
import type { EventData } from "@/lib/calendar/schemas";
import type { NoteKind } from "@/lib/notes/types";

/** What a note can change; the same keys as `noteFieldsSchema` but the calendar (RF-35). */
export interface NoteFields {
  title?: string;
  body?: string;
  color?: string | null;
  pinned?: boolean;
  archived?: boolean;
  dueDate?: string | null;
}

export interface ItemFields {
  text?: string;
  done?: boolean;
}

export type OfflineChange =
  | { type: "event.create"; id: string; data: EventData }
  | { type: "event.update"; id: string; base: EventData; data: EventData }
  | { type: "event.delete"; id: string; base: EventData }
  | {
      type: "note.create";
      id: string;
      kind: NoteKind;
      calendarId: string | null;
      fields: NoteFields;
    }
  | {
      type: "note.update";
      id: string;
      base: Required<NoteFields>;
      fields: NoteFields;
    }
  | { type: "note.delete"; id: string; base: Required<NoteFields> }
  | {
      type: "item.add";
      noteId: string;
      id: string;
      text: string;
      position: number;
      done: boolean;
    }
  | {
      type: "item.update";
      noteId: string;
      id: string;
      base: Required<ItemFields>;
      change: ItemFields;
    }
  | {
      type: "item.delete";
      noteId: string;
      id: string;
      base: Required<ItemFields>;
    }
  | {
      type: "item.move";
      noteId: string;
      positions: { id: string; position: number }[];
    };

export interface OutboxEntry {
  /** Stable id of the change: the key of "Deshacer" and of the lists (RF-30, RF-48). */
  changeId: string;
  /** ISO instant of the first change it holds. */
  createdAt: string;
  change: OfflineChange;
}

/** The thing a change is about: changes to the same one are merged (RF-42). */
export function entityOf(change: OfflineChange): string {
  switch (change.type) {
    case "event.create":
    case "event.update":
    case "event.delete":
      return `event:${change.id}`;
    case "note.create":
    case "note.update":
    case "note.delete":
      return `note:${change.id}`;
    case "item.move":
      return `order:${change.noteId}`;
    default:
      return `item:${change.id}`;
  }
}

/** The note a change belongs to, if any. */
export function noteOf(change: OfflineChange): string | null {
  if (change.type.startsWith("note.")) return (change as { id: string }).id;
  if (change.type.startsWith("item.")) {
    return (change as { noteId: string }).noteId;
  }
  return null;
}

/**
 * Two changes to the same thing as one (RF-42, RF-43): the base of the first
 * and the data of the last; `null` = nothing to send.
 */
function combine(
  first: OfflineChange,
  next: OfflineChange,
): OfflineChange | null | "keep" {
  if (first.type === "event.create") {
    if (next.type === "event.update") return { ...first, data: next.data };
    if (next.type === "event.delete") return null;
  }
  if (first.type === "event.update") {
    if (next.type === "event.update") return { ...first, data: next.data };
    if (next.type === "event.delete") {
      return { type: "event.delete", id: first.id, base: first.base };
    }
  }
  if (first.type === "note.create") {
    if (next.type === "note.update") {
      return { ...first, fields: { ...first.fields, ...next.fields } };
    }
    if (next.type === "note.delete") return null;
  }
  if (first.type === "note.update") {
    if (next.type === "note.update") {
      return { ...first, fields: { ...first.fields, ...next.fields } };
    }
    if (next.type === "note.delete") {
      return { type: "note.delete", id: first.id, base: first.base };
    }
  }
  if (first.type === "item.add") {
    if (next.type === "item.update") {
      return {
        ...first,
        text: next.change.text ?? first.text,
        done: next.change.done ?? first.done,
      };
    }
    if (next.type === "item.delete") return null;
  }
  if (first.type === "item.update") {
    if (next.type === "item.update") {
      return { ...first, change: { ...first.change, ...next.change } };
    }
    if (next.type === "item.delete") {
      return { ...next, base: first.base };
    }
  }
  if (first.type === "item.move" && next.type === "item.move") return next;
  // Anything else (a change after a delete) is kept as it came.
  return "keep";
}

/** The queue with one more change, merged into the one about the same thing. */
export function enqueue(
  queue: readonly OutboxEntry[],
  entry: OutboxEntry,
): OutboxEntry[] {
  const key = entityOf(entry.change);
  const index = queue.findLastIndex(
    (queued) => entityOf(queued.change) === key,
  );
  const merged =
    index === -1 ? "keep" : combine(queue[index]!.change, entry.change);
  let next: OutboxEntry[];
  if (merged === "keep") {
    next = [...queue, entry];
  } else {
    next = queue.filter((_, i) => i !== index);
    if (merged !== null) {
      next.splice(index, 0, { ...queue[index]!, change: merged });
    }
  }
  // A deleted note takes the pending changes of its items with it (RF-43).
  if (entry.change.type === "note.delete") {
    const noteId = entry.change.id;
    next = next.filter(
      (queued) =>
        !queued.change.type.startsWith("item.") ||
        noteOf(queued.change) !== noteId,
    );
  }
  return next;
}

/** The queue without one change: "Deshacer" of a change made offline (RF-30). */
export function withoutChange(
  queue: readonly OutboxEntry[],
  changeId: string,
): OutboxEntry[] {
  return queue.filter((entry) => entry.changeId !== changeId);
}

/**
 * Later changes that cannot go once `failed` was refused (RF-49): the same
 * thing, and the items of a note whose creation was refused.
 */
export function dependentsOf(
  queue: readonly OutboxEntry[],
  failed: OutboxEntry,
): OutboxEntry[] {
  const key = entityOf(failed.change);
  const note = failed.change.type === "note.create" ? failed.change.id : null;
  const at = queue.findIndex((entry) => entry.changeId === failed.changeId);
  return queue
    .slice(at + 1)
    .filter(
      (entry) =>
        entityOf(entry.change) === key ||
        (note !== null && noteOf(entry.change) === note),
    );
}
