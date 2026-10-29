import { createClient } from "@/lib/supabase/server";
import type { ConnectError } from "@/lib/sync/error-messages";
import { googleConfig } from "@/lib/sync/google-config";
import { CLEAR_STATE_COOKIE, readStateCookie } from "@/lib/sync/oauth-state";
import { exchangeCode } from "@/lib/sync/providers/google";
import { missingScopes, shortScope } from "@/lib/sync/scopes";

/**
 * Google comes back here. The state must match the cookie set by /start, and
 * the cookie is cleared whatever happens (plan D10; RF-3 to RF-5, RF-8, RF-32,
 * RF-47).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const url = new URL(request.url);
  const go = (path: string) =>
    new Response(null, {
      status: 307,
      headers: {
        location: new URL(path, url).toString(),
        "set-cookie": CLEAR_STATE_COOKIE,
      },
    });
  const fail = (code: ConnectError) =>
    go(`/dashboard/connections?error=${code}`);

  if ((await params).provider !== "google") {
    return new Response(null, { status: 404 });
  }

  const stored = readStateCookie(request.headers.get("cookie"));
  const state = url.searchParams.get("state");
  if (!stored || !state || stored.state !== state) return fail("failed");

  const error = url.searchParams.get("error");
  if (error) return fail(error === "access_denied" ? "cancelled" : "failed");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return go("/login");

  const code = url.searchParams.get("code");
  if (!code) return fail("failed");

  let account;
  try {
    account = await exchangeCode({
      ...googleConfig(url.origin),
      code,
      codeVerifier: stored.verifier,
    });
  } catch {
    return fail("failed");
  }

  // Without every permission the account only reads (spec 009 RF-5, plan D2).
  const missing = missingScopes(account.scope);
  const { data: connection, error: rpcError } = await supabase.rpc(
    "connect_account",
    {
      p_provider: "google",
      p_subject: account.subject,
      p_email: account.email,
      p_refresh_token: account.refreshToken,
      p_can_write: missing.length === 0,
    },
  );
  if (rpcError) return fail(rpcError.code === "CF429" ? "max" : "failed");

  const page = `/dashboard/connections/${(connection as { id: string }).id}`;
  return go(
    missing.length === 0
      ? page
      : `${page}?missing=${missing.map(shortScope).join(",")}`,
  );
}
