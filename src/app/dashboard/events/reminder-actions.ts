"use server";

import { requireActionUser } from "@/lib/calendar/queries";
import { parseReminders } from "@/lib/push/options";
import { writeReminders } from "@/lib/push/reminder-writes";

/** "Avisarme" in the detail: any member, Lectores included (spec 040 RF-7). */
export async function setEventReminders(
  eventId: string,
  minutes: number[],
): Promise<{ error?: string }> {
  const valid = parseReminders(minutes.length ? minutes.join(",") : "none");
  if (!valid) return { error: REMINDERS_NOT_SAVED };
  const { supabase, userId } = await requireActionUser();
  try {
    await writeReminders(supabase, userId, eventId, valid);
  } catch {
    return { error: REMINDERS_NOT_SAVED };
  }
  return {};
}

const REMINDERS_NOT_SAVED =
  "No se han podido guardar los avisos. Inténtalo de nuevo.";
