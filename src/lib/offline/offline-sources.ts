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
import type { Note } from "@/lib/notes/types";
import { canWriteEvents, readOnlyReason } from "@/lib/sync/read-only";
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
  // Offline only normal calendars take writes (RF-25).
  const canEdit = canWriteEvents(calendar) && !calendar.synced;
  const editable = copy.calendars.filter((c) => canWriteEvents(c) && !c.synced);
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
            limitReached: false,
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
      // No series can be made or changed offline (RF-24).
      repeat: "none",
    },
    calendars: editable.map(({ id, name, color }) => ({
      id,
      name,
      color,
      synced: false,
    })),
    categories: copy.categories.filter((c) =>
      editable.some((calendar) => calendar.id === c.calendarId),
    ),
    images: [],
    canAttach: false,
    series: event.seriesId ? { limitReached: false } : null,
  };
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
