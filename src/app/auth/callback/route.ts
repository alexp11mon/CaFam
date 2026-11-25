import { getSafeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

/** Linking Google from Ajustes comes back there (spec 050 RF-5). */
const SETTINGS = "/dashboard/settings";
/** An account this young was just made by this sign-in. */
const NEW_ACCOUNT_MS = 10 * 60_000;

/**
 * Where Google sends the person back (spec 050 RF-2, RF-9): the code becomes
 * the session in cookies, then the calendar or the invite of `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const asked = url.searchParams.get("next");
  const next = asked === SETTINGS ? SETTINGS : getSafeNextPath(asked);
  const from = next === SETTINGS ? SETTINGS : "/login";
  const back = (reason: "cancelled" | "error") =>
    Response.redirect(new URL(`${from}?google=${reason}`, url), 303);

  if (url.searchParams.get("error") === "access_denied") {
    return back("cancelled");
  }
  const code = url.searchParams.get("code");
  if (!code) return back("error");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return back("error");

  const destination = new URL(next, url);
  // RF-4: Google sends no zone, so a new account checks it on its first entry.
  const user = data?.user;
  if (
    user &&
    next !== SETTINGS &&
    !user.user_metadata?.time_zone &&
    Date.now() - Date.parse(user.created_at) < NEW_ACCOUNT_MS
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("time_zone")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) destination.searchParams.set("tzcheck", profile.time_zone);
  }
  return Response.redirect(destination, 303);
}
