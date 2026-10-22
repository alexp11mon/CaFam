"use server";

import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import {
  isMonthKey,
  monthMarks,
  type MonthMarks,
} from "@/lib/calendar/month-marks";
import {
  getEventsInRange,
  getProfileTimeZone,
  requireActionUser,
} from "@/lib/calendar/queries";
import { getVisibleRange } from "@/lib/calendar/ranges";

/**
 * Calendars with events on each day of another month, for the dots of the mini
 * month. Reads through RLS with the user's session (spec 005 RF-24, RF-26, plan D10).
 */
export async function loadMonthMarks(
  month: string,
): Promise<{ marks: MonthMarks } | { error: string }> {
  if (!isMonthKey(month)) return { error: CALENDAR_MESSAGES.notFound };
  const { supabase, userId } = await requireActionUser();
  try {
    const timeZone = await getProfileTimeZone(supabase, userId);
    const range = getVisibleRange("month", `${month}-01`, timeZone);
    const events = await getEventsInRange(supabase, range.from, range.to);
    return { marks: monthMarks(events, range.days, timeZone) };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
}
