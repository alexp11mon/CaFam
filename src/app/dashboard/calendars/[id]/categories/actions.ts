"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  CALENDAR_MESSAGES,
  getCalendarErrorMessage,
} from "@/lib/calendar/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import { categorySchema } from "@/lib/calendar/schemas";
import {
  fieldErrorsFromZod,
  readString,
  type ConfirmState,
  type FormState,
} from "@/lib/forms/form-state";

type CategoryState = FormState<"name">;
type Client = Awaited<ReturnType<typeof requireActionUser>>["supabase"];

const DUPLICATE_CODE = "23505";

function refresh() {
  // Drop the client router cache: the list and the calendar views must show the change.
  revalidatePath("/dashboard", "layout");
}

/** RLS hides rows without an error: tell "gone" apart from "not allowed" (RF-14). */
async function explainMissing(supabase: Client, id: string): Promise<string> {
  const { data } = await supabase
    .from("event_categories")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return data ? CALENDAR_MESSAGES.forbidden : CALENDAR_MESSAGES.notFound;
}

function failure(error: unknown, values: CategoryState["values"]) {
  // A duplicate belongs next to the field (RF-10).
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === DUPLICATE_CODE
  ) {
    return {
      fieldErrors: { name: CALENDAR_MESSAGES.duplicateCategory },
      values,
    };
  }
  return { formError: getCalendarErrorMessage(error), values };
}

export async function createCategory(
  calendarId: string,
  _prevState: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const values = { name: readString(formData, "name") };
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod<"name">(parsed.error), values };
  }
  if (!z.uuid().safeParse(calendarId).success) {
    return { formError: CALENDAR_MESSAGES.notFound, values };
  }

  const { supabase } = await requireActionUser();
  try {
    const { error } = await supabase
      .from("event_categories")
      .insert({ calendar_id: calendarId, name: parsed.data.name });
    if (error) return failure(error, values);
  } catch (error) {
    return failure(error, values);
  }

  refresh();
  return { values: { name: "" } };
}

export async function renameCategory(
  id: string,
  _prevState: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const values = { name: readString(formData, "name") };
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod<"name">(parsed.error), values };
  }
  if (!z.uuid().safeParse(id).success) {
    return { formError: CALENDAR_MESSAGES.notFound, values };
  }

  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("event_categories")
      .update({ name: parsed.data.name })
      .eq("id", id)
      .select("id");
    if (error) return failure(error, values);
    if (!data || data.length === 0) {
      return { formError: await explainMissing(supabase, id), values };
    }
  } catch (error) {
    return failure(error, values);
  }

  refresh();
  return { values: { name: parsed.data.name } };
}

// The state argument useActionState passes is not needed: nothing to carry over.
export async function deleteCategory(id: string): Promise<ConfirmState> {
  if (!z.uuid().safeParse(id).success) {
    return { formError: CALENDAR_MESSAGES.notFound };
  }

  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("event_categories")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return { formError: getCalendarErrorMessage(error) };
    if (!data || data.length === 0) {
      return { formError: await explainMissing(supabase, id) };
    }
  } catch (error) {
    return { formError: getCalendarErrorMessage(error) };
  }

  refresh();
  return {};
}
