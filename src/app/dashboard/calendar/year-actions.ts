"use server";

import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import type { MonthMarks } from "@/lib/calendar/month-marks";
import {
  getProfileTimeZone,
  getYearMarks,
  requireActionUser,
} from "@/lib/calendar/queries";

/** The marks of a year for the year view, through RLS (spec 042 RF-5). */
export async function loadYearMarks(
  year: number,
): Promise<{ marks: MonthMarks } | { error: string }> {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  const { supabase, userId } = await requireActionUser();
  try {
    const timeZone = await getProfileTimeZone(supabase, userId);
    return { marks: await getYearMarks(supabase, `${year}-01-01`, timeZone) };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
}
