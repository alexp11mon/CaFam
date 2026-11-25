"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { newPasswordSchema } from "@/lib/account/schemas";
import { getAccountErrorMessage } from "@/lib/account/error-messages";
import { signInMethods } from "@/lib/account/sign-in-methods";
import { requireActionUser } from "@/lib/calendar/queries";
import { readString } from "@/lib/forms/form-state";
import {
  IDENTITY_TEXTS,
  type IdentityState,
} from "@/lib/account/identity-texts";

// Spec 050, T3: "Formas de entrar" in Ajustes (RF-5, RF-6).

/** "Conectar Google": Google's consent, back to Ajustes (RF-5). */
export async function linkGoogle(): Promise<void> {
  const origin = (await headers()).get("origin");
  let url: string | null = null;
  if (origin) {
    const { supabase } = await requireActionUser();
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/dashboard/settings")}`,
        scopes: "openid email profile",
        skipBrowserRedirect: true,
      },
    });
    if (!error) url = data.url;
  }
  redirect(url ?? "/dashboard/settings?google=error");
}

/** "Desconectar Google", only while another way in remains (RF-5). */
export async function unlinkGoogle(): Promise<IdentityState> {
  try {
    const { supabase } = await requireActionUser();
    const { data } = await supabase.auth.getUser();
    if (!signInMethods(data.user).hasPassword) {
      return { formError: IDENTITY_TEXTS.needPassword };
    }
    const google = data.user?.identities?.find(
      (identity) => identity.provider === "google",
    );
    if (google) {
      const { error } = await supabase.auth.unlinkIdentity(google);
      if (error) {
        return {
          formError:
            error.code === "single_identity_not_deletable"
              ? IDENTITY_TEXTS.needPassword
              : getAccountErrorMessage(error),
        };
      }
    }
  } catch (error) {
    return { formError: getAccountErrorMessage(error) };
  }
  revalidatePath("/dashboard/settings");
  return { saved: IDENTITY_TEXTS.unlinked };
}

/** "Crear contraseña" of an account made with Google, without the current one (RF-6). */
export async function createPassword(
  _prevState: IdentityState,
  formData: FormData,
): Promise<IdentityState> {
  const parsed = newPasswordSchema.safeParse({
    password: readString(formData, "password"),
  });
  if (!parsed.success) return { formError: parsed.error.issues[0].message };
  try {
    const { supabase } = await requireActionUser();
    const { data } = await supabase.auth.getUser();
    if (signInMethods(data.user).hasPassword) {
      return { formError: IDENTITY_TEXTS.hasPassword };
    }
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: { has_password: true },
    });
    if (error) return { formError: getAccountErrorMessage(error) };
  } catch (error) {
    return { formError: getAccountErrorMessage(error) };
  }
  revalidatePath("/dashboard/settings");
  return { saved: IDENTITY_TEXTS.passwordCreated };
}
