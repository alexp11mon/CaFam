import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** What a member sees of a calendar updated from a link, never the link (spec 044 RF-11). */
export interface IcsSubscriptionInfo {
  state: "active" | "paused";
  lastReadAt: string | null;
  lastError: string | null;
}

/** The subscriptions of the user's calendars; RLS returns only those (RF-6). */
export async function getIcsSubscriptions(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, IcsSubscriptionInfo>> {
  const { data, error } = await supabase
    .from("ics_subscriptions")
    .select("calendar_id, state, last_read_at, last_error");
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      row.calendar_id,
      {
        state: row.state === "paused" ? "paused" : "active",
        lastReadAt: row.last_read_at,
        lastError: row.last_error,
      },
    ]),
  );
}
