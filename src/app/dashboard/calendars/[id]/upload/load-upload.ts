import { getCalendar, type CalendarRecord } from "@/lib/calendar/queries";
import type { UploadEvent } from "@/lib/sync/upload-calendar";
import type { requireActionUser } from "@/lib/calendar/queries";

type Supabase = Awaited<ReturnType<typeof requireActionUser>>["supabase"];

const PAGE = 1000;

/**
 * A calendar the user may upload: their own, normal and with an owner
 * (spec 009 RF-38). The database checks it again when converting.
 */
export async function uploadableCalendar(
  supabase: Supabase,
  userId: string,
  id: string,
): Promise<CalendarRecord | null> {
  const calendar = await getCalendar(supabase, userId, id);
  return calendar &&
    calendar.role === "owner" &&
    calendar.ownerId === userId &&
    !calendar.synced
    ? calendar
    : null;
}

/** Every row of the calendar; PostgREST returns at most 1,000 per query. */
export async function calendarEvents(
  supabase: Supabase,
  calendarId: string,
): Promise<UploadEvent[]> {
  const events: UploadEvent[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      // Series and exceptions too: the series go up as occurrences (spec 013 RF-30).
      .select(
        "id, title, description, location, starts_at, ends_at, all_day, recurrence, recurrence_tz, exdates, series_id, original_start",
      )
      .eq("calendar_id", calendarId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    events.push(...data);
    if (data.length < PAGE) return events;
  }
}
