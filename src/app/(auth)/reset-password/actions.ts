"use server";

import { redirect } from "next/navigation";
import {
  getAccountErrorMessage,
  ACCOUNT_MESSAGES,
} from "@/lib/account/error-messages";
import { newPasswordSchema } from "@/lib/account/schemas";
import type { ResetPasswordState } from "@/lib/account/form-state";
import { createClient } from "@/lib/supabase/server";
import { readString } from "@/lib/forms/form-state";

// Spec 006, T11: the recovery session sets the new password, then closes the
// other sessions of the account (RF-2, RF-4; plan D7).
export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = newPasswordSchema.safeParse({
    password: readString(formData, "password"),
  });
  if (!parsed.success) {
    return { fieldErrors: { password: parsed.error.issues[0].message } };
  }

  try {
    const supabase = await createClient();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
      return { formError: ACCOUNT_MESSAGES.invalidLink };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      return { formError: getAccountErrorMessage(error) };
    }

    await supabase.auth.signOut({ scope: "others" });
  } catch (error) {
    return { formError: getAccountErrorMessage(error) };
  }

  redirect("/dashboard/calendar");
}
