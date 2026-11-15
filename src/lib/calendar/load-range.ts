import { CALENDAR_MESSAGES } from "./error-messages";
import {
  getEventsInRange,
  getMyCalendars,
  getProfileTimeZone,
  requireActionUser,
} from "./queries";
import { daysBetween, daysRange } from "./ranges";
import { parseDateKey } from "./time-zone";
import { toViewEvents, type AgendaEvent } from "./to-view-events";

export type RangeResult = { events: AgendaEvent[] } | { error: string };

/**
 * Events of the days `from` to `to`, as the views draw them, for the server
 * actions that feed the browser (the agenda's chunks, spec 016 plan D8; the
 * calendar window, spec 024 RF-3, RF-4). Reads through RLS with the user's
 * session (P3).
 */
export async function loadEventsBetween(
  from: string,
  to: string,
  maxDays: number,
): Promise<RangeResult> {
  if (!parseDateKey(from) || !parseDateKey(to)) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  const days = daysBetween(from, to) + 1;
  if (days < 1 || days > maxDays) return { error: CALENDAR_MESSAGES.notFound };

  const { supabase, userId } = await requireActionUser();
  try {
    // Only the events need the zone: the calendars do not wait for it
    // (spec 023 RF-15).
    const calendarsRead = getMyCalendars(supabase, userId);
    const [records, calendars] = await Promise.all([
      getProfileTimeZone(supabase, userId).then((timeZone) => {
        const range = daysRange(from, to, timeZone);
        return getEventsInRange(supabase, range.from, range.to);
      }),
      calendarsRead,
    ]);
    return { events: toViewEvents(records, calendars) };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
}
