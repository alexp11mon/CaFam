import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRouteAccess } from "@/lib/auth/route-access";
import { THEME_COOKIE } from "@/lib/theme/theme";
import type { Database } from "@/types/database";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/** Refreshes the session cookies and applies the route guard (RF-8, RF-9, RF-10). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it validates
  // the JWT and refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const hasSession = Boolean(data?.claims);
  const access = getRouteAccess(request.nextUrl.pathname, hasSession);

  // Without a session the device follows the system, even with an old cookie (spec 011 RF-8).
  if (!hasSession && request.cookies.has(THEME_COOKIE)) {
    response.cookies.set(THEME_COOKIE, "", { path: "/", maxAge: 0 });
  }

  if (access.type === "redirect") {
    // The destination carries its own query (`next` for invites), nothing else is kept.
    const redirect = NextResponse.redirect(
      new URL(access.destination, request.nextUrl),
    );
    // Keep refreshed session cookies on the redirect response.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
