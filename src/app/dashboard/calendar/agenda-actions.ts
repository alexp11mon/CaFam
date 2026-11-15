"use server";

import { loadEventsBetween, type RangeResult } from "@/lib/calendar/load-range";

/** At most two of the agenda's 28-day chunks per call (plan D8). */
const MAX_DAYS = 62;

/**
 * Events of the days `from` to `to` for the continuous agenda. Reads through
 * RLS with the user's session (spec 016 RF-48, RF-49, plan D8, P3).
 */
export async function loadAgendaEvents(
  from: string,
  to: string,
): Promise<RangeResult> {
  return loadEventsBetween(from, to, MAX_DAYS);
}
