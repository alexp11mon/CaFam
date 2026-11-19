import type { SupabaseClient } from "@supabase/supabase-js";
import { allRows } from "@/lib/calendar/queries";
import type { Database } from "@/types/database";
import { writeIcs, type IcsRow } from "./write-ics";

// Reads with the user's session (RLS) what an .ics export needs (spec 043
// RF-1, RF-2, plan D4: the whole history).

type Client = SupabaseClient<Database>;

export type ExportTarget = { calendarId: string } | { visible: true };

export const EVENT_COLUMNS =
  "id, calendar_id, title, description, location, starts_at, ends_at, all_day, recurrence, recurrence_tz, exdates, series_id, original_start, created_at, updated_at, start_tz, end_tz";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The file of a calendar or of the visible ones, or null if there is none to see. */
export async function exportIcs(
  supabase: Client,
  userId: string,
  target: ExportTarget,
  now: Date,
): Promise<{ filename: string; text: string } | null> {
  let calendars: { id: string; name: string }[];
  if ("calendarId" in target) {
    if (!UUID.test(target.calendarId)) return null;
    const { data, error } = await supabase
      .from("calendars")
      .select("id, name")
      .eq("id", target.calendarId);
    if (error) throw error;
    calendars = data ?? [];
    if (calendars.length === 0) return null;
  } else {
    const [all, hidden] = await Promise.all([
      supabase.from("calendars").select("id, name"),
      supabase
        .from("calendar_preferences")
        .select("calendar_id")
        .eq("user_id", userId)
        .eq("visible", false),
    ]);
    if (all.error) throw all.error;
    if (hidden.error) throw hidden.error;
    const off = new Set((hidden.data ?? []).map((row) => row.calendar_id));
    calendars = (all.data ?? []).filter((row) => !off.has(row.id));
  }

  const names = new Map(calendars.map((row) => [row.id, row.name]));
  const rows =
    calendars.length === 0
      ? []
      : await allRows((first, last) =>
          supabase
            .from("events")
            .select(EVENT_COLUMNS)
            .in("calendar_id", [...names.keys()])
            .order("starts_at")
            .order("id")
            .range(first, last),
        );

  const single = "calendarId" in target;
  const icsRows: IcsRow[] = rows.map(({ calendar_id, ...row }) =>
    single ? row : { ...row, category: names.get(calendar_id) },
  );
  const name = single ? calendars[0]!.name : "CaFam";
  return {
    filename: single ? `${name}.ics` : "cafam.ics",
    text: writeIcs({ name, rows: icsRows, now }),
  };
}
