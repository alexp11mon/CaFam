"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_MESSAGES, getAuthErrorMessage } from "@/lib/auth/error-messages";
import type {
  SignInState,
  SignUpField,
  SignUpState,
} from "@/lib/auth/form-state";
import { getSafeNextPath } from "@/lib/auth/next-path";
import { signInSchema, signUpSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import {
  parseTheme,
  THEME_COOKIE,
  THEME_COOKIE_OPTIONS,
} from "@/lib/theme/theme";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signUp(
  _prevState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const values = {
    displayName: readString(formData, "displayName"),
    email: readString(formData, "email"),
  };
  const parsed = signUpSchema.safeParse({
    ...values,
    password: readString(formData, "password"),
    timeZone: formData.get("timeZone"),
  });

  if (!parsed.success) {
    const fieldErrors: SignUpState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as SignUpField;
      fieldErrors[field] ??= issue.message;
    }
    return { fieldErrors, values };
  }

  const { displayName, email, password, timeZone } = parsed.data;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, time_zone: timeZone } },
    });
    if (error) {
      return { formError: getAuthErrorMessage(error), values };
    }
    // "Confirm email" is off (plan D6), so a successful sign-up has a session.
    if (!data.session) {
      return { formError: AUTH_MESSAGES.connection, values };
    }
  } catch (error) {
    return { formError: getAuthErrorMessage(error), values };
  }

  // A new account starts on the system theme, whatever this device had (spec 011 RF-2).
  (await cookies()).delete(THEME_COOKIE);

  // `next` only survives if it is an invite link (RF-7, plan D9).
  redirect(getSafeNextPath(formData.get("next")));
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const values = { email: readString(formData, "email") };
  const parsed = signInSchema.safeParse({
    email: values.email,
    password: readString(formData, "password"),
  });

  // An empty or malformed field can never match an account (RF-6).
  if (!parsed.success) {
    return { formError: AUTH_MESSAGES.invalidCredentials, values };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      return { formError: getAuthErrorMessage(error), values };
    }
    // The first paint of the panel already has the theme of the account (spec 011 RF-4).
    const { data: profile } = await supabase
      .from("profiles")
      .select("theme")
      .eq("id", data.user.id)
      .maybeSingle();
    (await cookies()).set(
      THEME_COOKIE,
      parseTheme(profile?.theme),
      THEME_COOKIE_OPTIONS,
    );
  } catch (error) {
    return { formError: getAuthErrorMessage(error), values };
  }

  // `next` only survives if it is an invite link (RF-7, plan D9).
  redirect(getSafeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  // Without a session the device follows the system (spec 011 RF-8).
  (await cookies()).delete(THEME_COOKIE);
  redirect("/login");
}
