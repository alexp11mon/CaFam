"use server";

import type { BusyInput } from "@/lib/availability/busy";
import { getBusyIntervals } from "@/lib/availability/queries";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { WINDOW_MAX_DAYS } from "@/lib/calendar/event-window";
import { loadEventsBetween, type RangeResult } from "@/lib/calendar/load-range";
import { getProfileTimeZone, requireActionUser } from "@/lib/calendar/queries";
import { daysBetween, daysRange } from "@/lib/calendar/ranges";
import { parseDateKey } from "@/lib/calendar/time-zone";

/**
 * More days for the window of events the browser keeps, so that changing
 * period needs no request (spec 024 RF-3, RF-4). Through RLS, like the page.
 */
export async function loadCalendarWindow(
  from: string,
  to: string,
): Promise<RangeResult> {
  return loadEventsBetween(from, to, WINDOW_MAX_DAYS);
}

/** grid_busy refuses more than 32 days; a week with its slack is 9. */
const BUSY_MAX_DAYS = 31;

/**
 * "Ocupado" blocks of the marked people for the days of a week or a day,
 * asked for apart and only when someone is marked (spec 024 RF-9; spec 020).
 */
export async function loadBusy(
  from: string,
  to: string,
): Promise<{ busy: BusyInput[] } | { error: string }> {
  if (!parseDateKey(from) || !parseDateKey(to)) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  const days = daysBetween(from, to) + 1;
  if (days < 1 || days > BUSY_MAX_DAYS) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  const { supabase, userId } = await requireActionUser();
  try {
    const timeZone = await getProfileTimeZone(supabase, userId);
    const range = daysRange(from, to, timeZone);
    return { busy: await getBusyIntervals(supabase, range.from, range.to) };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
}
