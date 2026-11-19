// What the user sees offline: the copy with the queue on top (spec 034
// RF-26, RF-28, RF-37, plan D10). Pure: the copy itself never changes, so the
// base of a conflict and "Deshacer" still have the values from before.
import type { EventData } from "@/lib/calendar/schemas";
import type { Note, NoteItem } from "@/lib/notes/types";
import type { OutboxEntry } from "./outbox";
import type { OfflineEvent } from "./snapshot";

export type PendingEvent = OfflineEvent & { pending?: true };
export type PendingNote = Note & { pending?: true };

function withData(event: OfflineEvent, data: EventData): PendingEvent {
  return {
    ...event,
    title: data.title,
    calendarId: data.calendarId,
    allDay: data.allDay,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    description: data.description,
    location: data.location,
    color: data.color,
    categoryId: data.categoryId,
    ...(data.startTz === undefined
      ? {}
      : { startTz: data.startTz, endTz: data.endTz ?? data.startTz }),
    pending: true,
  };
}

function created(id: string, data: EventData): PendingEvent {
  return withData(
    {
      id,
      ...data,
      imageCount: 0,
      commentCount: 0,
      seriesId: null,
      createdBy: null,
      createdByName: null,
      seriesSummary: null,
      seriesChanged: false,
    },
    data,
  );
}

const byStart = (a: OfflineEvent, b: OfflineEvent) =>
  a.startsAt === b.startsAt
    ? a.id.localeCompare(b.id)
    : a.startsAt < b.startsAt
      ? -1
      : 1;

/** The events of the copy with the pending changes applied and marked. */
export function pendingEvents(
  events: readonly OfflineEvent[],
  queue: readonly OutboxEntry[],
): PendingEvent[] {
  const byId = new Map<string, PendingEvent>(
    events.map((event) => [event.id, event]),
  );
  for (const { change } of queue) {
    if (change.type === "event.create") {
      byId.set(change.id, created(change.id, change.data));
    } else if (change.type === "event.update") {
      const event = byId.get(change.id);
      if (event) byId.set(change.id, withData(event, change.data));
    } else if (change.type === "event.delete") {
      byId.delete(change.id);
    }
  }
  return [...byId.values()].sort(byStart);
}

const sortItems = (items: NoteItem[]) =>
  items.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

/** The notes of the copy with the pending changes applied and marked. */
export function pendingNotes(
  notes: readonly Note[],
  queue: readonly OutboxEntry[],
  now: string,
  /** The author of the notes created offline, for the limit of RF-36. */
  userId: string | null = null,
): PendingNote[] {
  const byId = new Map<string, PendingNote>(
    notes.map((note) => [note.id, { ...note, items: [...note.items] }]),
  );
  const touch = (id: string, change: (note: PendingNote) => PendingNote) => {
    const note = byId.get(id);
    if (note) byId.set(id, { ...change(note), pending: true, updatedAt: now });
  };
  for (const { change } of queue) {
    switch (change.type) {
      case "note.create":
        byId.set(change.id, {
          id: change.id,
          kind: change.kind,
          title: change.fields.title ?? "",
          body: change.fields.body ?? "",
          color: change.fields.color ?? null,
          pinned: change.fields.pinned ?? false,
          archived: change.fields.archived ?? false,
          dueDate: change.fields.dueDate ?? null,
          updatedAt: now,
          ownerId: userId,
          calendarId: change.calendarId,
          calendarName: null,
          items: [],
          pending: true,
        });
        break;
      case "note.update":
        touch(change.id, (note) => ({ ...note, ...change.fields }));
        break;
      case "note.delete":
        byId.delete(change.id);
        break;
      case "item.add":
        touch(change.noteId, (note) => ({
          ...note,
          items: [
            ...note.items.filter((item) => item.id !== change.id),
            {
              id: change.id,
              text: change.text,
              done: change.done,
              doneAt: change.done ? now : null,
              position: change.position,
            },
          ],
        }));
        break;
      case "item.update":
        touch(change.noteId, (note) => ({
          ...note,
          items: note.items.map((item) =>
            item.id === change.id
              ? {
                  ...item,
                  ...change.change,
                  doneAt:
                    change.change.done === undefined
                      ? item.doneAt
                      : change.change.done
                        ? (item.doneAt ?? now)
                        : null,
                }
              : item,
          ),
        }));
        break;
      case "item.delete":
        touch(change.noteId, (note) => ({
          ...note,
          items: note.items.filter((item) => item.id !== change.id),
        }));
        break;
      case "item.move": {
        const positions = new Map(
          change.positions.map(({ id, position }) => [id, position]),
        );
        touch(change.noteId, (note) => ({
          ...note,
          items: note.items.map((item) => ({
            ...item,
            position: positions.get(item.id) ?? item.position,
          })),
        }));
        break;
      }
      default:
        break;
    }
  }
  for (const note of byId.values()) sortItems(note.items);
  return [...byId.values()];
}
