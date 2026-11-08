import type { SupabaseClient } from "@supabase/supabase-js";
import { expandRows } from "@/lib/recurrence/read-series";
import type { Database } from "@/types/database";
import {
  busyBlocks,
  type BusyBlock,
  type BusyDay,
  type BusyInput,
  type VisibleTimes,
} from "./busy";

// Reads of other people's busy times (spec 020 plan "lib/availability/queries.ts").
// Server only: expandRows uses ical.js.

type Client = SupabaseClient<Database>;

export interface BusyPerson {
  id: string;
  name: string;
  shown: boolean;
}

/** People who consent and share a calendar with the user (RF-5, RF-17). */
export async function getBusyPeople(supabase: Client): Promise<BusyPerson[]> {
  const { data, error } = await supabase.rpc("busy_people");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    shown: p.shown,
  }));
}

/**
 * Busy blocks of the marked people in [from, to), at most 32 days (RF-8, RF-10,
 * RF-18), without what the user already sees (RF-13).
 */
export async function getBusyBlocks(
  supabase: Client,
  from: Date,
  to: Date,
  visible: readonly VisibleTimes[],
): Promise<{ timed: BusyBlock[]; allDay: BusyDay[] }> {
  const { data, error } = await supabase.rpc("grid_busy", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  const rows = data ?? [];

  const inputs: BusyInput[] = rows
    .filter((r) => !r.recurrence)
    .map((r) => ({
      personId: r.person_id,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      allDay: r.all_day,
    }));
  // grid_busy has no ids (plan D2): the index stands in, and the exceptions are
  // already in exdates, so no keys are needed.
  const series = rows
    .filter((r) => r.recurrence)
    .map((r, i) => ({ ...r, id: String(i), exdates: r.exdates ?? [] }));
  for (const { row, occurrence } of expandRows(series, [], from, to)) {
    inputs.push({
      personId: row.person_id,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      allDay: row.all_day,
    });
  }
  return busyBlocks(inputs, visible);
}
