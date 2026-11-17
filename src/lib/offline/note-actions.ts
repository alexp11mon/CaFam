// The writes of notes as the screens call them, queued when there is no
// network (spec 034 RF-31 to RF-36, plan D4). With a connection they are the
// actions of spec 028.
import {
  addItem,
  clearDone,
  createNote,
  deleteItem,
  deleteNote,
  moveItems,
  updateItem,
  updateNote,
  type NewNoteState,
  type NoteResult,
} from "@/app/dashboard/notes/actions";
import type { Note, NoteItem, NoteKind } from "@/lib/notes/types";
import { isNetworkError, isOnline } from "./connection";
import { itemBase, noteBase } from "./describe";
import { newItemError, newNoteError } from "./limits";
import { OFFLINE_MESSAGES } from "./messages";
import { loadPage } from "./navigate";
import type { NoteFields, OfflineChange } from "./outbox";
import { addChange, getQueueState } from "./queue-store";
import { getSnapshot } from "./snapshot-store";
import { isQueued, withOutbox } from "./with-outbox";

async function run(
  write: () => Promise<NoteResult>,
  change: OfflineChange | null,
): Promise<NoteResult> {
  if (!change && !isOnline()) return { error: OFFLINE_MESSAGES.needsNetwork };
  try {
    const result = await withOutbox(write, change);
    return isQueued(result) ? {} : result;
  } catch (error) {
    if (isNetworkError(error)) return { error: OFFLINE_MESSAGES.needsNetwork };
    throw error;
  }
}

/** Title, body, color, due date, pinned or archived; never the calendar offline (RF-35). */
export function updateNoteOrQueue(
  note: Note,
  fields: NoteFields & { calendarId?: string | null },
): Promise<NoteResult> {
  const { calendarId, ...rest } = fields;
  return run(
    () => updateNote(note.id, fields),
    calendarId === undefined
      ? { type: "note.update", id: note.id, base: noteBase(note), fields: rest }
      : null,
  );
}

export function deleteNoteOrQueue(note: Note): Promise<NoteResult> {
  return run(() => deleteNote(note.id), {
    type: "note.delete",
    id: note.id,
    base: noteBase(note),
  });
}

export function addItemOrQueue(
  note: Note,
  item: { id: string; text: string; position: number; done?: boolean },
): Promise<NoteResult> {
  // The limit of the copy, as the database would say it (RF-36).
  const full = !isOnline() ? newItemError(note) : null;
  if (full) return Promise.resolve({ error: full });
  return run(() => addItem(note.id, item), {
    type: "item.add",
    noteId: note.id,
    id: item.id,
    text: item.text,
    position: item.position,
    done: item.done ?? false,
  });
}

export function updateItemOrQueue(
  noteId: string,
  item: NoteItem,
  change: { text?: string; done?: boolean },
): Promise<NoteResult> {
  return run(() => updateItem(item.id, change), {
    type: "item.update",
    noteId,
    id: item.id,
    base: itemBase(item),
    change,
  });
}

export function moveItemsOrQueue(
  noteId: string,
  positions: { id: string; position: number }[],
): Promise<NoteResult> {
  return run(() => moveItems(noteId, positions), {
    type: "item.move",
    noteId,
    positions,
  });
}

export function deleteItemOrQueue(
  noteId: string,
  item: NoteItem,
): Promise<NoteResult> {
  return run(() => deleteItem(item.id), {
    type: "item.delete",
    noteId,
    id: item.id,
    base: itemBase(item),
  });
}

/** "Borrar los completados": one change per item offline (RF-33). */
export async function clearDoneOrQueue(note: Note): Promise<NoteResult> {
  if (isOnline() && getQueueState().queue.length === 0) {
    try {
      return await clearDone(note.id);
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  for (const item of note.items.filter((other) => other.done)) {
    await addChange({
      type: "item.delete",
      noteId: note.id,
      id: item.id,
      base: itemBase(item),
    });
  }
  return {};
}

/**
 * The form of a new note (RF-31): offline it is queued with the browser's id
 * and the note opens from the copy.
 */
export async function createNoteOrQueue(
  state: NewNoteState,
  formData: FormData,
  action: typeof createNote = createNote,
): Promise<NewNoteState> {
  const values = {
    title: String(formData.get("title") ?? ""),
    kind: String(formData.get("kind") ?? "list"),
    calendarId: String(formData.get("calendarId") ?? ""),
  };
  const snapshot = getSnapshot();
  const offline = !isOnline() || getQueueState().queue.length > 0;
  if (offline && snapshot) {
    const full = newNoteError(snapshot.notes, snapshot.userId);
    if (full) return { error: full, values };
  }
  const id = crypto.randomUUID();
  const change: OfflineChange | null = snapshot
    ? {
        type: "note.create",
        id,
        kind: (values.kind === "text" ? "text" : "list") as NoteKind,
        calendarId: values.calendarId || null,
        fields: { title: values.title.trim() },
      }
    : null;
  if (!change && !isOnline()) {
    return { error: OFFLINE_MESSAGES.needsNetwork, values };
  }
  let result: NewNoteState | Awaited<ReturnType<typeof withOutbox>>;
  try {
    result = await withOutbox(() => action(state, formData), change);
  } catch (error) {
    if (isNetworkError(error)) {
      return { error: OFFLINE_MESSAGES.needsNetwork, values };
    }
    throw error;
  }
  if (!isQueued(result)) return result as NewNoteState;
  // A full load: offline it goes through the service worker (spec 034 D3).
  loadPage(`/dashboard/notes/${id}`);
  return { values };
}
