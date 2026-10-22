"use server";

import { createClient } from "@/lib/supabase/server";
import { recoveryEmailSchema } from "@/lib/account/schemas";
import { getAccountErrorMessage } from "@/lib/account/error-messages";
import type { ForgotPasswordState } from "@/lib/account/form-state";
import { readString } from "@/lib/forms/form-state";

// Spec 006, T11: a recovery link is sent only if the per-account limit allows it
// (plan D6). The answer is the same either way (RF-1, RF-5; NF-1).
export async function requestRecovery(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const raw = readString(formData, "email");
  const values = { email: raw };
  const parsed = recoveryEmailSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      values,
      fieldErrors: { email: parsed.error.issues[0].message },
    };
  }

  try {
    const supabase = await createClient();
    const { data: allowed, error } = await supabase.rpc("request_recovery", {
      p_email: parsed.data,
    });
    if (error) {
      return { values, formError: getAccountErrorMessage(error) };
    }
    if (allowed) {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(
        parsed.data,
      );
      if (sendError) {
        return { values, formError: getAccountErrorMessage(sendError) };
      }
    }
  } catch (error) {
    return { values, formError: getAccountErrorMessage(error) };
  }

  return { sent: true, values: { email: "" } };
}
