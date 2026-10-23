"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ACCOUNT_MESSAGES,
  getAccountErrorMessage,
} from "@/lib/account/error-messages";
import type {
  EmailChangeState,
  PasswordChangeState,
  ProfileState,
} from "@/lib/account/form-state";
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  profileSchema,
} from "@/lib/account/schemas";
import { AUTH_MESSAGES } from "@/lib/auth/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import {
  fieldErrorsFromZod,
  readString,
  type ConfirmState,
} from "@/lib/forms/form-state";

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

const EMAIL_TAKEN_CODES = new Set(["email_exists", "user_already_exists"]);

/**
 * Starts an email change: the new address gets a confirmation link and the old
 * one keeps working until then (RF-6 to RF-10). Auth sends both emails.
 */
export async function requestEmailChange(
  _prevState: EmailChangeState,
  formData: FormData,
): Promise<EmailChangeState> {
  const values = { newEmail: readString(formData, "newEmail") };
  const parsed = changeEmailSchema.safeParse({
    newEmail: values.newEmail,
    currentPassword: readString(formData, "currentPassword"),
  });
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { newEmail, currentPassword } = parsed.data;

  const { supabase } = await requireActionUser();
  try {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return { values, formError: AUTH_MESSAGES.connection };
    if (newEmail === email) {
      return { values, fieldErrors: { newEmail: ACCOUNT_MESSAGES.sameEmail } };
    }

    const { error: checkError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (checkError) {
      return {
        values,
        fieldErrors: { currentPassword: getAccountErrorMessage(checkError) },
      };
    }

    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      const message = getAccountErrorMessage(error);
      return EMAIL_TAKEN_CODES.has(String(error.code))
        ? { values, fieldErrors: { newEmail: message } }
        : { values, formError: message };
    }
  } catch (error) {
    return { values, formError: getAccountErrorMessage(error) };
  }

  revalidatePath("/dashboard", "layout");
  return { values: { newEmail: "" }, pendingEmail: newEmail };
}

/**
 * Deletes the account after checking the own email and the password (RF-16,
 * RF-17). The database keeps the shared calendars for their other members
 * (delete_own_account, plan D1); here only the local session is closed (RF-19).
 */
export async function deleteAccount(
  _prevState: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const mismatch = { formError: ACCOUNT_MESSAGES.confirmationMismatch };
  const parsed = deleteAccountSchema.safeParse({
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });
  if (!parsed.success) return mismatch;

  const { supabase } = await requireActionUser();
  try {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email || email !== parsed.data.email) return mismatch;

    const { error: checkError } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });
    if (checkError) {
      return checkError.code === "invalid_credentials"
        ? mismatch
        : { formError: getAccountErrorMessage(checkError) };
    }

    const { error } = await supabase.rpc("delete_own_account");
    if (error) return { formError: getAccountErrorMessage(error) };

    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    return { formError: getAccountErrorMessage(error) };
  }

  redirect("/login");
}
