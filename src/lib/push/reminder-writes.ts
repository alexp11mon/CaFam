import type { SupabaseClient } from "@supabase/supabase-js";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import type { Database } from "@/types/database";

// The reminders of the user on an event, with their session: RLS keeps them
// personal and only on events they can see (spec 040 RF-7). Server only.

type Client = SupabaseClient<Database>;

/** A series keeps them on its own row: they warn on each occurrence (RF-8). */
export function reminderRowId(eventId: string): string | null {
  const parsed = parseEventId(eventId);
  if (!parsed) return null;
  return parsed.kind === "event" ? parsed.id : parsed.seriesId;
}

export async function readReminders(
  supabase: Client,
  userId: string,
  eventId: string,
): Promise<number[]> {
  const rowId = reminderRowId(eventId);
  if (!rowId) return [];
  const { data } = await supabase
    .from("event_reminders")
    .select("minutes")
    .eq("user_id", userId)
    .eq("event_id", rowId)
    .maybeSingle();
  return data?.minutes ?? [];
}

/** Replaces them; an empty list removes them. Throws on a database error. */
export async function writeReminders(
  supabase: Client,
  userId: string,
  eventId: string,
  minutes: number[],
): Promise<void> {
  const rowId = reminderRowId(eventId);
  if (!rowId) throw new Error("invalid event id");
  if (minutes.length === 0) {
    const { error } = await supabase
      .from("event_reminders")
      .delete()
      .eq("user_id", userId)
      .eq("event_id", rowId);
    if (error) throw error;
    return;
  }
  // No upsert: the client may only update `minutes`, not the key.
  const { data, error } = await supabase
    .from("event_reminders")
    .update({ minutes })
    .eq("user_id", userId)
    .eq("event_id", rowId)
    .select("event_id");
  if (error) throw error;
  if (data.length > 0) return;
  const { error: insertError } = await supabase
    .from("event_reminders")
    .insert({ event_id: rowId, minutes });
  if (insertError) throw insertError;
}

/** "Aviso por defecto" of the profile (spec 040 RF-6). */
export async function getReminderDefaults(
  supabase: Client,
  userId: string,
): Promise<{ timed: number | null; allDay: number | null }> {
  const { data } = await supabase
    .from("profiles")
    .select("reminder_minutes, reminder_all_day_minutes")
    .eq("id", userId)
    .maybeSingle();
  return {
    timed: data ? data.reminder_minutes : 10,
    allDay: data ? data.reminder_all_day_minutes : 1440,
  };
}
