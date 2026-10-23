import type {
  CalendarOption,
  CategoryOption,
  EventFormValues,
} from "@/components/calendar/event-form";
import { todayKey } from "@/lib/calendar/format";
import { parseNewEventQuery } from "@/lib/calendar/new-event-query";
import {
  getCategoriesForCalendars,
  getMyCalendars,
  getProfileTimeZone,
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
    };

/**
 * Everything the new-event form needs, for the full page and for the window
 * over the calendar alike (spec 008 RF-10, RF-11, plan event-loaders).
 */
export async function loadNewEvent(query: Query): Promise<NewEventData> {
  const { supabase, userId } = await requireUser();
  const [calendars, timeZone] = await Promise.all([
    getMyCalendars(supabase, userId),
    getProfileTimeZone(supabase, userId),
  ]);
  // Only calendars where the user can write (RF-27).
  const editable = calendars.filter((calendar) => calendar.role !== "viewer");
  if (editable.length === 0) return { kind: "no-calendar" };

  const categories = await getCategoriesForCalendars(
    supabase,
    editable.map((calendar) => calendar.id),
  );
  const defaults = parseNewEventQuery(
    query,
    editable.map((calendar) => calendar.id),
    todayKey(timeZone),
  );

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
    },
    calendars: editable.map(({ id, name, color }) => ({ id, name, color })),
    categories,
  };
}
