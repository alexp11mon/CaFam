"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import {
  fieldErrorsFromZod,
  readString,
  type ConfirmState,
} from "@/lib/forms/form-state";
import {
  getSharingErrorMessage,
  SHARING_MESSAGES,
} from "@/lib/sharing/error-messages";
import { memberRoleSchema } from "@/lib/sharing/schemas";

type Client = Awaited<ReturnType<typeof requireActionUser>>["supabase"];

function refresh() {
  // Drop the client router cache so the panel and the lists show the change.
  revalidatePath("/dashboard", "layout");
}

function validIds(calendarId: string, userId: string): boolean {
  return (
    z.uuid().safeParse(calendarId).success && z.uuid().safeParse(userId).success
  );
}

/** RLS hides rows without an error: tell the owner row, "not allowed" and "gone" apart (RF-28, RF-29). */
async function explainMissing(
  supabase: Client,
  calendarId: string,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("calendar_members")
    .select("role")
    .eq("calendar_id", calendarId)
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.role === "owner") return SHARING_MESSAGES.ownerCannotLeave;
  return data ? SHARING_MESSAGES.forbidden : CALENDAR_MESSAGES.notFound;
}

// The state argument useActionState passes is not needed: nothing to carry over.
export async function changeMemberRole(
  calendarId: string,
  userId: string,
  _prevState: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const parsed = memberRoleSchema.safeParse({
    userId,
    role: readString(formData, "role"),
  });
  if (!parsed.success) {
    const errors = fieldErrorsFromZod<"userId" | "role">(parsed.error);
    return { formError: errors.role ?? CALENDAR_MESSAGES.notFound };
  }
  if (!validIds(calendarId, userId)) {
    return { formError: CALENDAR_MESSAGES.notFound };
  }

  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("calendar_members")
      .update({ role: parsed.data.role })
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .select("role");
    if (error) return { formError: getSharingErrorMessage(error) };
    if (!data || data.length === 0) {
      return { formError: await explainMissing(supabase, calendarId, userId) };
    }
  } catch (error) {
    return { formError: getSharingErrorMessage(error) };
  }

  refresh();
  return {};
}

export async function expelMember(
  calendarId: string,
  userId: string,
): Promise<ConfirmState> {
  if (!validIds(calendarId, userId)) {
    return { formError: CALENDAR_MESSAGES.notFound };
  }

  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("calendar_members")
      .delete()
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .select("user_id");
    if (error) return { formError: getSharingErrorMessage(error) };
    if (!data || data.length === 0) {
      return { formError: await explainMissing(supabase, calendarId, userId) };
    }
  } catch (error) {
    return { formError: getSharingErrorMessage(error) };
  }

  refresh();
  return {};
}

export async function leaveCalendar(calendarId: string): Promise<ConfirmState> {
  if (!z.uuid().safeParse(calendarId).success) {
    return { formError: CALENDAR_MESSAGES.notFound };
  }

  const { supabase, userId } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("calendar_members")
      .delete()
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .select("user_id");
    if (error) return { formError: getSharingErrorMessage(error) };
    if (!data || data.length === 0) {
      return { formError: await explainMissing(supabase, calendarId, userId) };
    }
  } catch (error) {
    return { formError: getSharingErrorMessage(error) };
  }

  refresh();
  redirect("/dashboard");
}
