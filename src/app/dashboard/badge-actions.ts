"use server";

import { todayLeft } from "@/lib/badge/today-left";
import { todayKey } from "@/lib/calendar/format";
import {
  getEventsInRange,
  getPreferences,
  requireActionUser,
} from "@/lib/calendar/queries";
import {
  addDays,
  parseDateKey,
  zonedLocalToUtc,
} from "@/lib/calendar/time-zone";
import type { TodayBadge } from "@/lib/hooks/use-app-badge";

/**
 * Today's timed events still to finish, in the profile's zone and the
 * visible calendars, read with the session (spec 047 RF-12).
 */
export async function loadTodayBadge(): Promise<TodayBadge> {
  const { supabase, userId } = await requireActionUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("time_zone, badge_today")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.badge_today) return { enabled: false, count: 0 };

  const now = new Date();
  const zone = profile.time_zone ?? "Europe/Madrid";
  const tomorrow = parseDateKey(addDays(todayKey(zone, now), 1))!;
  const dayEnd = zonedLocalToUtc({ ...tomorrow, hour: 0, minute: 0 }, zone);
  const [events, { calendarPreferences }] = await Promise.all([
    getEventsInRange(supabase, now, dayEnd),
    getPreferences(supabase, userId),
  ]);
  const hidden = new Set(
    calendarPreferences
      .filter((preference) => !preference.visible)
      .map((preference) => preference.calendarId),
  );
  return { enabled: true, count: todayLeft(events, hidden, now, dayEnd) };
}
