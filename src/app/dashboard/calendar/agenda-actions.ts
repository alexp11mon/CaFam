"use server";

import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import {
  getEventsInRange,
  getMyCalendars,
  getProfileTimeZone,
  requireActionUser,
} from "@/lib/calendar/queries";
import { daysBetween, daysRange } from "@/lib/calendar/ranges";
import { parseDateKey } from "@/lib/calendar/time-zone";
import { toViewEvents, type AgendaEvent } from "@/lib/calendar/to-view-events";

/** At most two of the agenda's 28-day chunks per call (plan D8). */
const MAX_DAYS = 62;

/**
 * Events of the days `from` to `to` for the continuous agenda. Reads through
 * RLS with the user's session (spec 016 RF-48, RF-49, plan D8, P3).
 */
export async function loadAgendaEvents(
  from: string,
  to: string,
): Promise<{ events: AgendaEvent[] } | { error: string }> {
  if (!parseDateKey(from) || !parseDateKey(to)) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  const days = daysBetween(from, to) + 1;
  if (days < 1 || days > MAX_DAYS) return { error: CALENDAR_MESSAGES.notFound };

  const { supabase, userId } = await requireActionUser();
  try {
    const timeZone = await getProfileTimeZone(supabase, userId);
    const range = daysRange(from, to, timeZone);
    const [calendars, records] = await Promise.all([
      getMyCalendars(supabase, userId),
      getEventsInRange(supabase, range.from, range.to),
    ]);
    return { events: toViewEvents(records, calendars) };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
}
