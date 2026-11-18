// What the screens get from the server, taken from the device's copy in the
// offline app (spec 034 RF-8, RF-13, RF-15, plan offline-sources). Pure but
// for `todayKey`, which reads the clock.
import type { EventData as LoadedEvent } from "@/app/dashboard/events/load-event";
import { calendarProps } from "@/lib/calendar/calendar-props";
import { eventsInRange } from "@/lib/calendar/event-window";
import { eventToFormDates, todayKey } from "@/lib/calendar/format";
import { monthMarks } from "@/lib/calendar/month-marks";
import { parseNewEventQuery } from "@/lib/calendar/new-event-query";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import { daysRange, getVisibleRange } from "@/lib/calendar/ranges";
import { toViewEvents, type AgendaEvent } from "@/lib/calendar/to-view-events";
import { authorLabel } from "@/lib/account/author-label";
import type { EventImage } from "@/lib/images/queries";
import type { Note } from "@/lib/notes/types";
import { MAX_RESULTS, MIN_QUERY } from "@/lib/search/limits";
import { matchesAll, queryTerms } from "@/lib/search/normalize";
import type { SearchResult } from "@/lib/search/queries";
import { canWriteEvents, readOnlyReason } from "@/lib/sync/read-only";
import { repeatOfSeries } from "./describe";
import { canDeleteImage, offlineMoveTargets } from "./gates";
import { OFFLINE_MESSAGES } from "./messages";
import type { OutboxEntry } from "./outbox";
import { pendingEvents, pendingNotes } from "./overlay";
import type { Snapshot } from "./snapshot";

const done = async () => ({});

/** The days of the copy as instants, with the zone of the profile. */
function eventsOf(copy: Snapshot, from: string, to: string): AgendaEvent[] {
  const span = daysRange(from, to, copy.profile.timeZone);
  return toViewEvents(
    eventsInRange(copy.events, span.from, span.to),
    copy.calendars,
  );
}

/** Everything CalendarClient takes, from the copy (RF-7, RF-8, RF-15). */
export function offlineCalendarProps(copy: Snapshot) {
  const { timeZone } = copy.profile;
  const today = todayKey(timeZone);
  const now = Date.now();
  const props = calendarProps({
    userId: copy.userId,
    calendars: copy.calendars,
    people: copy.people,
    groups: copy.groups,
    preferences: copy.preferences,
    upcoming: copy.events.filter(
      (event) =>
        Date.parse(event.endsAt) >= now &&
        Date.parse(event.startsAt) <= now + 48 * 3_600_000,
    ),
  });
  const load = async (from: string, to: string) => ({
    events: eventsOf(copy, from, to),
  });
  return {
    ...props,
    window: {
      range: copy.range,
      events: eventsOf(copy, copy.range.from, copy.range.to),
    },
    initialBusy: [],
    loadWindow: load,
    loadAgendaEvents: load,
    loadBusy: async () => ({ busy: [] }),
    loadMonthMarks: async (month: string) => {
      const range = getVisibleRange("month", `${month}-01`, timeZone);
      return {
        marks: monthMarks(
          eventsInRange(copy.events, range.from, range.to),
          range.days,
          timeZone,
        ),
      };
    },
    // The year's marks from the copy's events (spec 042 RF-13).
    loadYearMarks: async (year: number) => {
      const range = getVisibleRange("year", `${year}-01-01`, timeZone);
      return {
        marks: monthMarks(
          eventsInRange(copy.events, range.from, range.to),
          range.days,
          timeZone,
        ),
      };
    },
    // Filters change on this device only, unsaved (RF-15).
    setCalendarVisibility: done,
    setPersonVisibility: done,
    setGroupVisibility: done,
    saveOrder: done,
    saveLastView: done,
    setShowBusy: done,
    busyPeople: [],
    today,
    timeZone,
    categories: copy.categories,
    userId: copy.userId,
    showWeekends: copy.profile.showWeekends,
    defaultDuration: copy.profile.duration,
    loadedAt: now,
  };
}

/** An event's detail and its form, from the copy with what waits (RF-13). */
export function detailFromSnapshot(
  copy: Snapshot,
  queue: readonly OutboxEntry[],
  id: string,
): LoadedEvent | null {
  const event = pendingEvents(copy.events, queue).find((e) => e.id === id);
  const calendar = copy.calendars.find((c) => c.id === event?.calendarId);
  if (!event || !calendar) return null;
  const { timeZone } = copy.profile;
  // Offline the rules of always, Google and iCloud included (spec 035 RF-1).
  const canEdit = canWriteEvents(calendar);
  // Moves within the same account, as online (spec 035 RF-3).
  const editable = offlineMoveTargets(calendar, copy.calendars);
  const series = copy.series.find((s) => s.id === event.seriesId);
  // An occurrence without its own row at 100 changes takes no more (spec 013 RF-32).
  const limitReached =
    !copy.exceptions.some((e) => e.id === event.id) &&
    (series?.totals.exceptions ?? 0) >= 100;
  return {
    detail: {
      id: event.id,
      pending: "pending" in event || undefined,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      // Unknown for an event seen only in a window read again (plan R6).
      description: event.partial
        ? OFFLINE_MESSAGES.descriptionOnline
        : event.description,
      location: event.location,
      color: event.color,
      calendarName: calendar.name,
      calendarColor: calendar.color ?? DEFAULT_CALENDAR_COLOR,
      categoryName:
        copy.categories.find((c) => c.id === event.categoryId)?.name ?? null,
      author: event.createdByName ?? "",
      readOnly: readOnlyReason(calendar.synced),
      provider: calendar.synced?.provider,
      repeat: event.seriesId
        ? {
            summary: event.seriesSummary ?? "",
            changed: event.seriesChanged,
            limitReached,
          }
        : null,
    },
    timeZone,
    canEdit,
    editInitial: {
      title: event.title,
      calendarId: event.calendarId,
      allDay: event.allDay ? "on" : "",
      ...eventToFormDates(event, timeZone),
      description: event.partial ? "" : (event.description ?? ""),
      location: event.location ?? "",
      color: event.color ?? "",
      categoryId: event.categoryId ?? "",
      // Series are changed offline too (spec 035 RF-10, RF-11).
      repeat: series ? repeatOfSeries(series) : "none",
    },
    calendars: editable.map(({ id, name, color, synced }) => ({
      id,
      name,
      color,
      synced: Boolean(synced),
    })),
    categories: copy.categories.filter((c) =>
      editable.some((calendar) => calendar.id === c.calendarId),
    ),
    images: imagesFromSnapshot(copy, event.id, calendar.role),
    // Any member adds images, viewers included (spec 035 RF-32).
    canAttach: true,
    series: event.seriesId ? { limitReached } : null,
  };
}

/** The saved images of an event as the detail shows them (spec 035 RF-30, RF-36). */
export function imagesFromSnapshot(
  copy: Snapshot,
  eventId: string,
  role: "owner" | "editor" | "viewer",
): EventImage[] {
  const members = copy.people.map((person) => ({
    userId: person.id,
    name: person.displayName,
  }));
  return copy.images
    .filter((image) => image.eventId === eventId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((image) => ({
      id: image.id,
      objectId: image.objectId,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
      author: authorLabel(image.uploadedBy, members),
      canDelete: canDeleteImage(image, copy.userId, role),
    }));
}

/** The notes of the copy with what waits, as the board and the editor see them. */
export function offlineNotes(
  copy: Snapshot,
  queue: readonly OutboxEntry[],
): Note[] {
  return pendingNotes(copy.notes, queue, new Date().toISOString(), copy.userId);
}

/** The user's role in each calendar, for the access of a note (spec 028 RF-10). */
export function roleIn(copy: Snapshot, calendarId: string | null) {
  if (!calendarId) return null;
  return copy.calendars.find((c) => c.id === calendarId)?.role ?? null;
}

/** The form of a new event or a duplicate, from the copy (RF-19, RF-22). */
export function newEventFromSnapshot(
  copy: Snapshot,
  queue: readonly OutboxEntry[],
  query: Record<string, string>,
) {
  const editable = copy.calendars.filter((c) => canWriteEvents(c) && !c.synced);
  if (editable.length === 0) return null;
  const calendars = editable.map(({ id, name, color }) => ({
    id,
    name,
    color,
    synced: false,
  }));
  const categories = copy.categories.filter((c) =>
    editable.some((calendar) => calendar.id === c.calendarId),
  );
  const defaults = parseNewEventQuery(
    query,
    editable.map((c) => c.id),
    todayKey(copy.profile.timeZone),
    copy.profile.duration,
  );
  const source = defaults.from
    ? detailFromSnapshot(copy, queue, defaults.from)
    : null;
  if (source) {
    const same = editable.some((c) => c.id === source.editInitial.calendarId);
    return {
      calendars,
      categories,
      initial: {
        ...source.editInitial,
        calendarId: same ? source.editInitial.calendarId : defaults.calendarId,
        categoryId: same ? source.editInitial.categoryId : "",
      },
    };
  }
  return {
    calendars,
    categories,
    initial: {
      title: defaults.title,
      calendarId: defaults.calendarId,
      allDay: defaults.allDay ? "on" : "",
      startDate: defaults.date,
      startTime: defaults.startTime,
      endDate: defaults.date,
      endTime: defaults.endTime,
      description: "",
      location: "",
      color: "",
      categoryId: "",
      repeat: "none",
    },
  };
}

/** "Buscar" without a connection: the note above the results (spec 039 RF-10). */
export const OFFLINE_SEARCH_NOTE =
  "Buscando solo en los datos de este dispositivo (de hoy −1 mes a +3 meses)";

/**
 * The search on the copy, with the same criterion as the server (spec 039
 * RF-10): its events (occurrences already expanded) and their comments.
 * shortcut: changes still in the queue are not searched; they are a few and
 * are sent as soon as the network is back.
 */
export function searchOffline(
  copy: Snapshot,
  query: string,
): { results: SearchResult[]; more: boolean } {
  const terms = queryTerms(query);
  if (query.trim().length < MIN_QUERY || terms.length === 0) {
    return { results: [], more: false };
  }
  const comments = new Map<string, string>();
  // Newest last, so the newest matching comment wins.
  for (const comment of [...copy.comments].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    if (matchesAll(comment.body, terms))
      comments.set(comment.eventId, comment.body);
  }
  const results = copy.events
    .filter(
      (event) =>
        comments.has(event.id) ||
        matchesAll(
          `${event.title} ${event.location ?? ""} ${event.description ?? ""}`,
          terms,
        ),
    )
    .map((event) => ({
      ...event,
      matchedComment: comments.get(event.id) ?? null,
    }));
  return {
    results: results.slice(0, MAX_RESULTS),
    more: results.length > MAX_RESULTS,
  };
}
