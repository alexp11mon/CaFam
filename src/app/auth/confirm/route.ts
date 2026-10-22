import { getConfirmPlan } from "@/lib/account/confirm-type";
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

  const destination = error ? plan.failure : plan.success;
  return Response.redirect(new URL(destination, url), 303);
}
