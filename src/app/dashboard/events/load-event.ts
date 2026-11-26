import { summarizeRRule } from "@/lib/recurrence/summary";
import type { EventDetailData } from "@/components/calendar/event-detail";
import type {
  CalendarOption,
  CategoryOption,
  EventFormValues,
} from "@/components/calendar/event-form";
import { authorLabel } from "@/lib/account/author-label";
import { originalLabel, zonedFormDates } from "@/lib/calendar/event-zone";
import { getEventImages, type EventImage } from "@/lib/images/queries";
import {
  getCalendar,
  getCategoriesForCalendars,
  getEvent,
  getMyCalendars,
  getProfileLocale,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { readReminders } from "@/lib/push/reminder-writes";
import { getMembers } from "@/lib/sharing/queries";
import {
  canWriteEvents,
  moveTargets,
  readOnlyReason,
} from "@/lib/sync/read-only";

export interface EventData {
  detail: EventDetailData;
  timeZone: string;
  /** Owner or editor; viewers only read (RF-26). */
  canEdit: boolean;
  editInitial: EventFormValues;
  calendars: CalendarOption[];
  categories: CategoryOption[];
  /** Ready images in upload order (spec 012 RF-9). */
  images: EventImage[];
  /** Any member attaches images, viewers and synced calendars included (spec 012 RF-4, RF-8). */
  canAttach: boolean;
  /** An occurrence: saving asks the scope (spec 013 RF-15, RF-32). */
  series: { limitReached: boolean } | null;
  /** The user's own reminders, on the series for an occurrence; none offline (spec 040 RF-7). */
  reminders?: number[];
}

/**
 * An event and what editing it needs, for the full page and the window over
 * the calendar alike (spec 008 RF-10, RF-11, plan event-loaders). Null for an
 * invalid, foreign (RLS hides it) or just deleted id: each route decides.
 */
export async function loadEvent(id: string): Promise<EventData | null> {
  const { supabase, userId } = await requireUser();
  const event = await getEvent(supabase, id);
  if (!event) return null;
  // Independent reads go together: opening an event was a chain of 7 to 10
  // round trips (spec 023 RF-14).
  const [calendar, timeZone, members, reminders, locale] = await Promise.all([
    getCalendar(supabase, userId, event.calendarId),
    getProfileTimeZone(supabase, userId),
    getMembers(supabase, [event.calendarId]),
    readReminders(supabase, userId, id),
    getProfileLocale(supabase, userId),
  ]);
  if (!calendar) return null;

  const canEdit = canWriteEvents(calendar);
  const [myCalendars, images] = await Promise.all([
    canEdit ? getMyCalendars(supabase, userId) : [],
    // An occurrence without its own row has no images yet (spec 013 RF-24).
    event.rowId
      ? getEventImages(supabase, event.rowId, userId, calendar.role, members)
      : [],
  ]);
  // A synced event only moves inside its Google account (spec 009 RF-19, RF-20).
  const editable = moveTargets(calendar, myCalendars);
  const categories = await getCategoriesForCalendars(
    supabase,
    canEdit ? editable.map((c) => c.id) : [event.calendarId],
  );
  const category = categories.find((c) => c.id === event.categoryId);

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
      readOnly: readOnlyReason(calendar.synced),
      provider: calendar.synced?.provider,
      originalTime: originalLabel(
        { ...event, recurrenceTz: event.series?.recurrenceTz },
        timeZone,
      ),
      repeat: event.series
        ? {
            summary:
              locale === "es"
                ? event.series.summary
                : summarizeRRule(event.series.recurrence, locale),
            changed: event.series.changed,
            limitReached: !event.rowId && event.series.exceptions >= 100,
          }
        : null,
    },
    timeZone,
    canEdit,
    editInitial: {
      title: event.title,
      calendarId: event.calendarId,
      allDay: event.allDay ? "on" : "",
      // In the event's own zone, if it has one (spec 045 RF-3).
      ...zonedFormDates(
        { ...event, recurrenceTz: event.series?.recurrenceTz },
        timeZone,
      ),
      description: event.description ?? "",
      location: event.location ?? "",
      color: event.color ?? "",
      categoryId: event.categoryId ?? "",
      // An occurrence shows its series' rule (spec 013 RF-21).
      repeat: event.series ? `custom:${event.series.recurrence}` : "none",
    },
    calendars: editable.map(({ id, name, color, synced }) => ({
      id,
      name,
      color,
      synced: synced !== null,
    })),
    categories,
    images,
    canAttach: true,
    // An existing exception adds none (RF-32).
    series: event.series
      ? { limitReached: !event.rowId && event.series.exceptions >= 100 }
      : null,
    reminders,
  };
}
