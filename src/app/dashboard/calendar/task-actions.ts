"use server";

import type { CalendarTask } from "@/components/calendar/task-block";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import { daysBetween } from "@/lib/calendar/ranges";
import { parseDateKey } from "@/lib/calendar/time-zone";

/** A month view with its weeks is 42 days; the agenda asks for no more. */
const TASKS_MAX_DAYS = 62;

/**
 * Pending notes and items with a due date in [from, to], the ones the user
 * sees through RLS and of visible calendars (spec 048 RF-6, RF-8).
 */
export async function loadTasks(
  from: string,
  to: string,
): Promise<{ tasks: CalendarTask[] } | { error: string }> {
  if (!parseDateKey(from) || !parseDateKey(to)) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  const days = daysBetween(from, to) + 1;
  if (days < 1 || days > TASKS_MAX_DAYS) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase.rpc("calendar_tasks", {
      p_from: from,
      p_to: to,
    });
    if (error) return { error: CALENDAR_MESSAGES.connection };
    return {
      tasks: (data ?? []).map((row) => ({
        noteId: row.note_id,
        itemId: row.item_id,
        text: row.text,
        noteTitle: row.note_title,
        calendarId: row.calendar_id,
        dueDate: row.due_date,
        dueTime: row.due_time,
      })),
    };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
}
