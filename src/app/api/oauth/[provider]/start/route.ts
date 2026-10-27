import { createClient } from "@/lib/supabase/server";
import { googleConfig } from "@/lib/sync/google-config";
import { createOAuthState, stateCookie } from "@/lib/sync/oauth-state";
import { authorizationUrl } from "@/lib/sync/providers/google";

/** Sends the signed-in user to Google's consent screen (spec 007; RF-1, RF-2). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const url = new URL(request.url);
  if ((await params).provider !== "google") {
    return new Response(null, { status: 404 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) {
    return Response.redirect(new URL("/login", url), 307);
  }

  const oauth = createOAuthState();
  const { clientId, redirectUri } = googleConfig(url.origin);
  return new Response(null, {
    status: 307,
    headers: {
      location: authorizationUrl({
        clientId,
        redirectUri,
        state: oauth.state,
        codeChallenge: oauth.challenge,
      }),
      "set-cookie": stateCookie(oauth),
    },
  });
}
