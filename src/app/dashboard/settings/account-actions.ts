"use server";

import { revalidatePath } from "next/cache";
import {
  ACCOUNT_MESSAGES,
  getAccountErrorMessage,
} from "@/lib/account/error-messages";
import type {
  PasswordChangeState,
  ProfileState,
} from "@/lib/account/form-state";
import { changePasswordSchema, profileSchema } from "@/lib/account/schemas";
import { AUTH_MESSAGES } from "@/lib/auth/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import { fieldErrorsFromZod, readString } from "@/lib/forms/form-state";

const PROFILE_NOT_SAVED =
  "No se ha podido guardar el perfil. Inténtalo de nuevo.";

/** Name and time zone of the own profile; RLS limits the update to that row (RF-13 to RF-15). */
export async function saveProfile(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const values = {
    displayName: readString(formData, "displayName"),
    timeZone: readString(formData, "timeZone"),
  };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { supabase, userId } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        time_zone: parsed.data.timeZone,
      })
      .eq("id", userId)
      .select("id");
    if (error || !data?.length) {
      return { values, formError: PROFILE_NOT_SAVED };
    }
  } catch {
    return { values, formError: AUTH_MESSAGES.connection };
  }

  // Names show up in member lists and avatars, and the zone in every view (RF-13, RF-14).
  revalidatePath("/dashboard", "layout");
  return { values: parsed.data, saved: true };
}

/**
 * Checks the current password, saves the new one and closes the other sessions
 * (RF-30 to RF-33; plan D7). The check signs in again with the same account,
 * which only renews this browser's session.
 */
export async function changePassword(
  _prevState: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: readString(formData, "currentPassword"),
    newPassword: readString(formData, "newPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { currentPassword, newPassword } = parsed.data;
  if (newPassword === currentPassword) {
    return { fieldErrors: { newPassword: ACCOUNT_MESSAGES.sameAsCurrent } };
  }

  const { supabase } = await requireActionUser();
  try {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return { formError: AUTH_MESSAGES.connection };

    const { error: checkError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (checkError) {
      return {
        fieldErrors: { currentPassword: getAccountErrorMessage(checkError) },
      };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { formError: getAccountErrorMessage(error) };

    await supabase.auth.signOut({ scope: "others" });
  } catch (error) {
    return { formError: getAccountErrorMessage(error) };
  }

  return { saved: true };
}
