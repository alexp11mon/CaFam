import { getConfirmPlan } from "@/lib/account/confirm-type";
import { cookies } from "next/headers";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing page of the recovery and email change links (plan D8). The token is
 * verified here on the server and the session is kept in cookies, so the link
 * works even when it is opened in another browser (RF-2, RF-11).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const plan = getConfirmPlan(url.searchParams.get("type"));
  if (!plan) {
    return Response.redirect(new URL("/login", url), 303);
  }

  const tokenHash = url.searchParams.get("token_hash");
  if (!tokenHash) {
    return Response.redirect(new URL(plan.failure, url), 303);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: plan.otpType,
    token_hash: tokenHash,
  });

  let destination = error ? plan.failure : plan.success;
  // The invite that started the sign-up, kept on this device (spec 049 RF-5).
  if (!error && (plan.otpType === "signup" || plan.otpType === "email")) {
    const store = await cookies();
    const next = readPending(store.get(PENDING_COOKIE)?.value)?.next;
    if (next?.startsWith("/invite/")) destination = next;
    store.delete(PENDING_COOKIE);
  }
  return Response.redirect(new URL(destination, url), 303);
}
