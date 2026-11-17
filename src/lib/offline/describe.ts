// What each write of the screen means as a change of the queue (spec 034
// RF-19 to RF-23, RF-31 to RF-34; plan "Modelo de datos"). Pure: the base is
// the copy the user saw, the data is what the write leaves.
import { placeAt } from "@/lib/calendar/drag";
import type { EventData } from "@/lib/calendar/schemas";
import type { Change } from "@/lib/calendar/undo";
import type { AgendaEvent } from "@/lib/calendar/to-view-events";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import type { Note, NoteItem } from "@/lib/notes/types";
import type { ItemFields, NoteFields, OfflineChange } from "./outbox";
import type { OfflineEvent } from "./snapshot";

/** An event of the copy as the schemas write it; a partial one has no description (R6). */
export function eventDataOf(event: OfflineEvent): EventData {
  return {
    title: event.title,
    calendarId: event.calendarId,
    allDay: event.allDay,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    description: (event.partial
      ? undefined
      : event.description) as EventData["description"],
    location: event.location,
    color: event.color,
    categoryId: event.categoryId,
  };
}

/** A drag, a resize or a color from the menu (RF-22). */
export function quickChangeOf(
  event: OfflineEvent,
  change: Change,
): OfflineChange {
  const base = eventDataOf(event);
  const data =
    change.kind === "times"
      ? {
          ...base,
          startsAt: change.startsAt,
          endsAt: change.endsAt,
          allDay: change.allDay,
        }
      : { ...base, color: change.color };
  return { type: "event.update", id: event.id, base, data };
}

/** The form or the quick window saved over an event of the copy (RF-20, RF-21). */
export function updateOf(event: OfflineEvent, data: EventData): OfflineChange {
  const base = eventDataOf(event);
  // A partial event keeps the server's description unless one was written (R6).
  const description =
    base.description === undefined && !data.description
      ? (undefined as unknown as EventData["description"])
      : data.description;
  return {
    type: "event.update",
    id: event.id,
    base,
    data: { ...data, description },
  };
}

export function deleteOf(event: OfflineEvent): OfflineChange {
  return { type: "event.delete", id: event.id, base: eventDataOf(event) };
}

/** A pasted copy: a new event with the browser's id (RF-22, plan D6). */
export function pasteOf(
  event: OfflineEvent,
  place: { day: string; minute?: number },
  timeZone: string,
  id: string,
): OfflineChange {
  const times = placeAt(event, place.day, place.minute, timeZone);
  return {
    type: "event.create",
    id,
    data: { ...eventDataOf(event), description: event.description, ...times },
  };
}

/** The fields of a note that a change compares (RF-53). */
export function noteBase(note: Note): Required<NoteFields> {
  return {
    title: note.title,
    body: note.body,
    color: note.color,
    pinned: note.pinned,
    archived: note.archived,
    dueDate: note.dueDate,
  };
}

export function itemBase(item: NoteItem): Required<ItemFields> {
  return { text: item.text, done: item.done };
}

type Calendar = { id: string; name: string; color: string };

function toView(
  id: string,
  data: EventData,
  calendar: Calendar | undefined,
  from?: AgendaEvent,
): AgendaEvent & { pending: true } {
  return {
    ...from,
    id,
    title: data.title,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    allDay: data.allDay,
    calendarId: data.calendarId,
    categoryId: data.categoryId,
    color: data.color ?? calendar?.color ?? DEFAULT_CALENDAR_COLOR,
    ownColor: data.color,
    location: data.location,
    calendarName: calendar?.name ?? "",
    pending: true,
  };
}

/**
 * The events a view draws with the queue on top (RF-26, RF-28): what waits is
 * shown as it will be, marked `pending`.
 */
export function pendingView<T extends AgendaEvent>(
  events: readonly T[],
  queue: readonly { change: OfflineChange }[],
  calendars: readonly Calendar[],
): (T | (AgendaEvent & { pending: true }))[] {
  if (queue.length === 0) return events as T[];
  const byCalendar = new Map(calendars.map((c) => [c.id, c]));
  const byId = new Map<string, T | (AgendaEvent & { pending: true })>(
    events.map((event) => [event.id, event]),
  );
  for (const { change } of queue) {
    if (change.type === "event.create" || change.type === "event.update") {
      const before = byId.get(change.id);
      if (change.type === "event.update" && !before) continue;
      byId.set(
        change.id,
        toView(
          change.id,
          change.data,
          byCalendar.get(change.data.calendarId),
          before,
        ),
      );
    } else if (change.type === "event.delete") {
      byId.delete(change.id);
    }
  }
  return [...byId.values()];
}
