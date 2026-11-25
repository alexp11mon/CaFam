import { getSafeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google sends the person back (spec 050 RF-2, RF-9): the code becomes
 * the session in cookies, then the calendar or the invite of `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (reason: "cancelled" | "error") =>
    Response.redirect(new URL(`/login?google=${reason}`, url), 303);

  if (url.searchParams.get("error") === "access_denied")
    return back("cancelled");
  const code = url.searchParams.get("code");
  if (!code) return back("error");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return back("error");

  return Response.redirect(
    new URL(getSafeNextPath(url.searchParams.get("next")), url),
    303,
  );
}
