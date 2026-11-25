import { getSafeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

/** Linking Google from Ajustes comes back there (spec 050 RF-5). */
const SETTINGS = "/dashboard/settings";

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
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return back("error");

  return Response.redirect(new URL(next, url), 303);
}
