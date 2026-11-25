// What each write of the screen means as a change of the queue (spec 034
// RF-19 to RF-23, RF-31 to RF-34; plan "Modelo de datos"). Pure: the base is
// the copy the user saw, the data is what the write leaves.
import { placeAt } from "@/lib/calendar/drag";
import type { EventData } from "@/lib/calendar/schemas";
import type { Change } from "@/lib/calendar/undo";
import type { AgendaEvent } from "@/lib/calendar/to-view-events";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import type { Note, NoteItem } from "@/lib/notes/types";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import type {
  ItemBase,
  ItemFields,
  NoteFields,
  OfflineChange,
  SeriesBase,
  SeriesScope,
} from "./outbox";
import type { OfflineEvent, OfflineSeries } from "./snapshot";

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

export function itemBase(item: NoteItem): Required<ItemFields> & ItemBase {
  return {
    text: item.text,
    done: item.done,
    dueDate: item.dueDate ?? null,
    dueTime: item.dueTime ?? null,
  };
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

/** A series of the copy as the base of a change to all of it (spec 035 D3). */
export function seriesBaseOf(series: OfflineSeries): SeriesBase {
  return {
    fields: {
      title: series.title,
      calendarId: series.calendarId,
      allDay: series.allDay,
      startsAt: series.startsAt,
      endsAt: series.endsAt,
      description: series.description,
      location: series.location,
      color: series.color,
      categoryId: series.categoryId,
    },
    recurrence: series.recurrence,
    exdates: series.exdates,
    totals: series.totals,
  };
}

/** The value "Repetir" has for a series: its rule as it is (spec 013). */
export const repeatOfSeries = (series: OfflineSeries) =>
  `custom:${series.recurrence}`;

/**
 * A change of an occurrence in "Este y los siguientes" or "Todos los
 * eventos" (spec 035 RF-10); `repeat` as the form sends it.
 */
export function seriesUpdateOf(
  occurrenceId: string,
  series: OfflineSeries,
  scope: SeriesScope,
  data: EventData,
  repeat: string = repeatOfSeries(series),
): OfflineChange {
  return {
    type: "series.update",
    id: occurrenceId,
    scope,
    base: seriesBaseOf(series),
    data,
    repeat,
  };
}

export function seriesDeleteOf(
  occurrenceId: string,
  series: OfflineSeries,
  scope: SeriesScope,
): OfflineChange {
  return {
    type: "series.delete",
    id: occurrenceId,
    scope,
    base: seriesBaseOf(series),
  };
}

/** True for a change that makes or changes a whole series (spec 035 RF-11). */
function makesSeries(change: OfflineChange): boolean {
  if (change.type === "series.update" || change.type === "series.delete") {
    return change.scope !== "this";
  }
  return (
    (change.type === "event.create" || change.type === "event.update") &&
    change.repeat !== undefined &&
    change.repeat !== "none"
  );
}

/** The series the queue changes as a whole: their occurrences are drawn again. */
export function touchedSeries(
  queue: readonly { change: OfflineChange }[],
): Set<string> {
  const touched = new Set<string>();
  for (const { change } of queue) {
    if (!makesSeries(change)) continue;
    const id = (change as { id: string }).id;
    const parsed = parseEventId(id);
    touched.add(parsed?.kind === "occurrence" ? parsed.seriesId : id);
  }
  return touched;
}

/**
 * The view with the occurrences of the touched series as they will be
 * (spec 035 RF-12): `expanded` comes from `pendingSeries`, loaded apart.
 */
export function withSeries<T extends AgendaEvent>(
  view: readonly T[],
  expanded: readonly AgendaEvent[],
  touched: ReadonlySet<string>,
): (T | AgendaEvent)[] {
  const inTouched = (event: AgendaEvent) =>
    touched.has(event.seriesId ?? event.id);
  return [
    ...view.filter((event) => !inTouched(event)),
    ...expanded.filter(inTouched),
  ];
}
