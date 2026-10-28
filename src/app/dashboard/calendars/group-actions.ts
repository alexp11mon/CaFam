"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  CALENDAR_MESSAGES,
  getCalendarErrorMessage,
} from "@/lib/calendar/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import { groupSchema } from "@/lib/calendar/schemas";
import {
  fieldErrorsFromZod,
  readString,
  type ConfirmState,
  type FormState,
} from "@/lib/forms/form-state";

// The user's private calendar groups (spec 007 RF-35 to RF-41, plan D13, D14).
// RLS limits every write to the user's own groups and preference rows.

type GroupState = FormState<"name">;
type Result = { error?: string };

const CALENDAR_CONFLICT = { onConflict: "user_id,calendar_id" };

function refresh() {
  // "Mis calendarios" and the calendar filters show the groups.
  revalidatePath("/dashboard", "layout");
}

function hasCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function failure(error: unknown, values: GroupState["values"]): GroupState {
  // A repeated name belongs next to the field (RF-35).
  if (hasCode(error, "23505")) {
    return { fieldErrors: { name: CALENDAR_MESSAGES.duplicateGroup }, values };
  }
  return { formError: getCalendarErrorMessage(error), values };
}

function parseName(formData: FormData) {
  const values = { name: readString(formData, "name") };
  return { values, parsed: groupSchema.safeParse(values) };
}

export async function createGroup(
  _prevState: GroupState,
  formData: FormData,
): Promise<GroupState> {
  const { values, parsed } = parseName(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod<"name">(parsed.error), values };
  }

  const { supabase, userId } = await requireActionUser();
  try {
    const { error } = await supabase
      .from("calendar_groups")
      .insert({ user_id: userId, name: parsed.data.name });
    if (error) return failure(error, values);
  } catch (error) {
    return failure(error, values);
  }

  refresh();
  return { values: { name: "" } };
}

export async function renameGroup(
  id: string,
  _prevState: GroupState,
  formData: FormData,
): Promise<GroupState> {
  const { values, parsed } = parseName(formData);
  if (!z.uuid().safeParse(id).success) {
    return { formError: CALENDAR_MESSAGES.groupGone, values };
  }
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod<"name">(parsed.error), values };
  }

  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("calendar_groups")
      .update({ name: parsed.data.name })
      .eq("id", id)
      .select("id");
    if (error) return failure(error, values);
    // Only the user's groups are visible, so no row means it is gone.
    if (!data || data.length === 0) {
      return { formError: CALENDAR_MESSAGES.groupGone, values };
    }
  } catch (error) {
    return failure(error, values);
  }

  refresh();
  return { values: { name: parsed.data.name } };
}

/** Its calendars go back to "sin grupo"; the foreign key does it (RF-41). */
export async function deleteGroup(id: string): Promise<ConfirmState> {
  if (!z.uuid().safeParse(id).success) {
    return { formError: CALENDAR_MESSAGES.groupGone };
  }

  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("calendar_groups")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return { formError: getCalendarErrorMessage(error) };
    if (!data || data.length === 0) {
      return { formError: CALENDAR_MESSAGES.groupGone };
    }
  } catch (error) {
    return { formError: getCalendarErrorMessage(error) };
  }

  refresh();
  return {};
}

/** Puts a calendar in a group, or takes it out with null (RF-36, RF-37). */
export async function assignToGroup(
  calendarId: string,
  groupId: string | null,
): Promise<Result> {
  if (!z.uuid().safeParse(calendarId).success) {
    return { error: CALENDAR_MESSAGES.notFound };
  }
  if (groupId !== null && !z.uuid().safeParse(groupId).success) {
    return { error: CALENDAR_MESSAGES.groupGone };
  }

  const { supabase, userId } = await requireActionUser();
  try {
    const { error } = await supabase
      .from("calendar_preferences")
      .upsert(
        { user_id: userId, calendar_id: calendarId, group_id: groupId },
        CALENDAR_CONFLICT,
      );
    // The composite key refuses a group of someone else or a deleted one.
    if (hasCode(error, "23503")) return { error: CALENDAR_MESSAGES.groupGone };
    if (error) return { error: getCalendarErrorMessage(error) };
  } catch (error) {
    return { error: getCalendarErrorMessage(error) };
  }

  refresh();
  return {};
}

/** Shows or hides every calendar of the group; nothing is stored on the group (RF-39, plan D14). */
export async function setGroupVisibility(
  groupId: string,
  visible: boolean,
): Promise<Result> {
  if (!z.uuid().safeParse(groupId).success) {
    return { error: CALENDAR_MESSAGES.groupGone };
  }

  const { supabase, userId } = await requireActionUser();
  try {
    // The calendar list comes from the database, not from the client.
    const { data, error } = await supabase
      .from("calendar_preferences")
      .select("calendar_id")
      .eq("user_id", userId)
      .eq("group_id", groupId);
    if (error) return { error: getCalendarErrorMessage(error) };
    if (!data || data.length === 0) return {};

    const { error: upsertError } = await supabase
      .from("calendar_preferences")
      .upsert(
        data.map(({ calendar_id }) => ({
          user_id: userId,
          calendar_id,
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
