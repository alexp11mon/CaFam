import type {
  CalendarOption,
  CategoryOption,
  EventFormValues,
} from "@/components/calendar/event-form";
import { zonedFormDates } from "@/lib/calendar/event-zone";
import { todayKey } from "@/lib/calendar/format";
import { parseNewEventQuery } from "@/lib/calendar/new-event-query";
import { getReminderDefaults } from "@/lib/push/reminder-writes";
import { canWriteEvents } from "@/lib/sync/read-only";
import {
  getCategoriesForCalendars,
  getEvent,
  getMyCalendars,
  getProfileTimeZone,
  getViewOptions,
  requireUser,
} from "@/lib/calendar/queries";

type Query = { [key: string]: string | string[] | undefined };

export type NewEventData =
  | { kind: "no-calendar" }
  | {
      kind: "form";
      initial: EventFormValues;
      calendars: CalendarOption[];
      categories: CategoryOption[];
      /** The defaults of the profile (spec 040 RF-6). */
      reminderDefaults: { timed: number | null; allDay: number | null };
      /** "Escribe el evento" for a new one, not a duplicate (spec 041 RF-11). */
      phrase?: { timeZone: string; defaultMinutes: number };
      /** The profile's zone, for "Zona horaria" (spec 045 RF-1). */
      timeZone: string;
    };

/**
 * Everything the new-event form needs, for the full page and for the window
 * over the calendar alike (spec 008 RF-10, RF-11, plan event-loaders).
 */
export async function loadNewEvent(query: Query): Promise<NewEventData> {
  const { supabase, userId } = await requireUser();
  const [calendars, timeZone, viewOptions, reminderDefaults] =
    await Promise.all([
      getMyCalendars(supabase, userId),
      getProfileTimeZone(supabase, userId),
      getViewOptions(supabase, userId),
      getReminderDefaults(supabase, userId),
    ]);
  // Only calendars where the user can write (RF-27), synced ones included when
  // their account writes (spec 009 RF-9).
  const editable = calendars.filter(canWriteEvents);
  if (editable.length === 0) return { kind: "no-calendar" };

  const categories = await getCategoriesForCalendars(
    supabase,
    editable.map((calendar) => calendar.id),
  );
  const defaults = parseNewEventQuery(
    query,
    editable.map((calendar) => calendar.id),
    todayKey(timeZone),
    viewOptions.duration,
  );

  // "Duplicar": the same event as a new one, nothing saved until confirmed (spec 008 RF-35).
  // RLS decides whether the copied event can be read at all.
  const source = defaults.from ? await getEvent(supabase, defaults.from) : null;
  if (source) {
    const sameCalendar = editable.some((c) => c.id === source.calendarId);
    return {
      kind: "form",
      initial: {
        title: source.title,
        calendarId: sameCalendar ? source.calendarId : defaults.calendarId,
        allDay: source.allDay ? "on" : "",
        // The copy keeps the zone (spec 045 RF-11).
        ...zonedFormDates(
          { ...source, recurrenceTz: source.series?.recurrenceTz },
          timeZone,
        ),
        description: source.description ?? "",
        location: source.location ?? "",
        color: source.color ?? "",
        // A category only fits its own calendar (RF-28).
        categoryId: sameCalendar ? (source.categoryId ?? "") : "",
        // A duplicated occurrence is a single event (spec 013 RF-22).
        repeat: "none",
      },
      calendars: editable.map(({ id, name, color, synced }) => ({
        id,
        name,
        color,
        synced: synced !== null,
      })),
      categories,
      reminderDefaults,
      timeZone,
    };
  }

  return {
    kind: "form",
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
      startTz: "",
      endTz: "",
    },
    calendars: editable.map(({ id, name, color, synced }) => ({
      id,
      name,
      color,
      synced: synced !== null,
    })),
    categories,
    reminderDefaults,
    phrase: { timeZone, defaultMinutes: viewOptions.duration },
    timeZone,
  };
}
