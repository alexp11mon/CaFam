import type { EventDetailData } from "@/components/calendar/event-detail";
import type {
  CalendarOption,
  CategoryOption,
  EventFormValues,
} from "@/components/calendar/event-form";
import { authorLabel } from "@/lib/account/author-label";
import { eventToFormDates } from "@/lib/calendar/format";
import {
  getCalendar,
  getCategoriesForCalendars,
  getEvent,
  getMyCalendars,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { getMembers } from "@/lib/sharing/queries";
import { canWriteEvents } from "@/lib/sync/read-only";

export interface EventData {
  detail: EventDetailData;
  timeZone: string;
  /** Owner or editor; viewers only read (RF-26). */
  canEdit: boolean;
  editInitial: EventFormValues;
  calendars: CalendarOption[];
  categories: CategoryOption[];
}

/**
 * An event and what editing it needs, for the full page and the window over
 * the calendar alike (spec 008 RF-10, RF-11, plan event-loaders). Null for an
 * invalid, foreign (RLS hides it) or just deleted id: each route decides.
 */
export async function loadEvent(id: string): Promise<EventData | null> {
  const { supabase, userId } = await requireUser();
  const event = await getEvent(supabase, id);
  const calendar = event
    ? await getCalendar(supabase, userId, event.calendarId)
    : null;
  if (!event || !calendar) return null;

  const canEdit = canWriteEvents(calendar);
  const timeZone = await getProfileTimeZone(supabase, userId);
  const myCalendars = canEdit ? await getMyCalendars(supabase, userId) : [];
  const editable = myCalendars.filter(canWriteEvents);
  const categories = await getCategoriesForCalendars(
    supabase,
    canEdit ? editable.map((c) => c.id) : [event.calendarId],
  );
  const category = categories.find((c) => c.id === event.categoryId);
  const members = await getMembers(supabase, [event.calendarId]);

  return {
    detail: {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      description: event.description,
      location: event.location,
      color: event.color,
      calendarName: calendar.name,
      calendarColor: calendar.color,
      categoryName: category?.name ?? null,
      author: authorLabel(event.createdBy, members),
      synced: calendar.synced !== null,
    },
    timeZone,
    canEdit,
    editInitial: {
      title: event.title,
      calendarId: event.calendarId,
      allDay: event.allDay ? "on" : "",
      ...eventToFormDates(event, timeZone),
      description: event.description ?? "",
      location: event.location ?? "",
      color: event.color ?? "",
      categoryId: event.categoryId ?? "",
    },
    calendars: editable.map(({ id, name, color }) => ({ id, name, color })),
    categories,
  };
}
