"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSafeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

// Spec 050, T2: Google's consent, only `openid email profile`, back to
// /auth/callback (RF-2, plan "Resumen"). @supabase/ssr keeps the PKCE
// verifier in a cookie (RNF-1).
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = getSafeNextPath(formData.get("next"));
  const origin = (await headers()).get("origin");
  let url: string | null = null;
  if (origin) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: "openid email profile",
        skipBrowserRedirect: true,
      },
    });
    if (!error) url = data.url;
  }
  redirect(url ?? "/login?google=error");
}
