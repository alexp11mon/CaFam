"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  CALENDAR_MESSAGES,
  getCalendarErrorMessage,
} from "@/lib/calendar/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import { isCalendarView } from "@/lib/calendar/ranges";

type Result = { error?: string };

const CALENDAR_CONFLICT = { onConflict: "user_id,calendar_id" };
const PERSON_CONFLICT = { onConflict: "user_id,person_id" };

const orderSchema = z.object({
  people: z.array(z.uuid()),
  // The user's own groups, in order (spec 007 RF-38).
  groups: z.array(z.uuid()).optional(),
  // Keyed by section: a person id, a group id or the group without owner (spec 006 RF-22).
  // Only the calendar ids are written.
  calendars: z.record(z.string(), z.array(z.uuid())),
});

export type SavedOrder = z.infer<typeof orderSchema>;

function refresh() {
  // Drop the client router cache so the panel and the views come back with the new state.
  revalidatePath("/dashboard", "layout");
}

// Every write is an upsert of the user's own rows, which RLS enforces (RF-48).
// Partial payloads keep the other column: visibility never resets a saved position.

export async function setCalendarVisibility(
  calendarId: string,
  visible: boolean,
): Promise<Result> {
  if (!z.uuid().safeParse(calendarId).success) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  const { supabase, userId } = await requireActionUser();
  try {
    const { error } = await supabase
      .from("calendar_preferences")
      .upsert(
        { user_id: userId, calendar_id: calendarId, visible },
        CALENDAR_CONFLICT,
      );
    if (error) return { error: getCalendarErrorMessage(error) };
  } catch (error) {
    return { error: getCalendarErrorMessage(error) };
  }
  refresh();
  return {};
}

/** Shows or hides every calendar of a person the user can see (RF-44). */
export async function setPersonVisibility(
  personId: string,
  visible: boolean,
): Promise<Result> {
  if (!z.uuid().safeParse(personId).success) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  const { supabase, userId } = await requireActionUser();
  try {
    // The calendar list comes from the database, not from the client.
    const { data, error } = await supabase
      .from("calendars")
      .select("id")
      .eq("owner_id", personId);
    if (error) return { error: getCalendarErrorMessage(error) };
    if (!data || data.length === 0) return {};

    const { error: upsertError } = await supabase
      .from("calendar_preferences")
      .upsert(
        data.map(({ id }) => ({
          user_id: userId,
          calendar_id: id,
          visible,
        })),
        CALENDAR_CONFLICT,
      );
    if (upsertError) return { error: getCalendarErrorMessage(upsertError) };
  } catch (error) {
    return { error: getCalendarErrorMessage(error) };
  }
  refresh();
  return {};
}

/** Saves the position of every person and of every calendar within its owner (RF-45). */
export async function saveOrder(order: SavedOrder): Promise<Result> {
  const parsed = orderSchema.safeParse(order);
  if (!parsed.success) return { error: CALENDAR_MESSAGES.invalidData };
  const { people, groups = [], calendars } = parsed.data;
  const { supabase, userId } = await requireActionUser();

  try {
    if (people.length > 0) {
      const { error } = await supabase.from("person_preferences").upsert(
        people.map((personId, position) => ({
          user_id: userId,
          person_id: personId,
          position,
        })),
        PERSON_CONFLICT,
      );
      if (error) return { error: getCalendarErrorMessage(error) };
    }

    // Only the position: RLS limits the update to the user's own groups.
    for (const [position, id] of groups.entries()) {
      const { error } = await supabase
        .from("calendar_groups")
        .update({ position })
        .eq("id", id);
      if (error) return { error: getCalendarErrorMessage(error) };
    }

    const rows = Object.values(calendars).flatMap((ids) =>
      ids.map((calendarId, position) => ({
        user_id: userId,
        calendar_id: calendarId,
        position,
      })),
    );
    if (rows.length > 0) {
      const { error } = await supabase
        .from("calendar_preferences")
        .upsert(rows, CALENDAR_CONFLICT);
      if (error) return { error: getCalendarErrorMessage(error) };
    }
  } catch (error) {
    return { error: getCalendarErrorMessage(error) };
  }
  refresh();
  return {};
}

/**
 * Remembers the chosen view in the user's own profile row, the same on every
 * device (spec 008 RF-25, plan D7). Nothing on screen changes: no revalidation.
 */
export async function saveLastView(view: string): Promise<Result> {
  if (!isCalendarView(view)) return { error: CALENDAR_MESSAGES.notFound };
  const { supabase, userId } = await requireActionUser();
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ last_view: view })
      .eq("id", userId);
    if (error) return { error: getCalendarErrorMessage(error) };
  } catch (error) {
    return { error: getCalendarErrorMessage(error) };
  }
  return {};
}
