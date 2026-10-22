export type RouteAccess =
  { type: "allow" } | { type: "redirect"; destination: string };

const PROTECTED_PREFIX = "/dashboard";
const INVITE_PREFIX = "/invite";
const GUEST_ONLY_PATHS = new Set(["/login", "/signup"]);
// Needs a session, which the recovery link creates (spec 006 T11).
const SESSION_PATHS = new Set(["/reset-password"]);

function isProtected(pathname: string): boolean {
  return (
    pathname === PROTECTED_PREFIX ||
    pathname.startsWith(`${PROTECTED_PREFIX}/`) ||
    SESSION_PATHS.has(pathname)
  );
}

/** Pure routing decision used by src/proxy.ts (plan D3; RF-8, RF-9). */
export function getRouteAccess(
  pathname: string,
  hasSession: boolean,
): RouteAccess {
  if (!hasSession && isProtected(pathname)) {
    return { type: "redirect", destination: "/login" };
  }
  // An invite link survives the login detour through `next` (RF-7, plan D9).
  if (
    !hasSession &&
    pathname.startsWith(`${INVITE_PREFIX}/`) &&
    pathname.length > INVITE_PREFIX.length + 1
  ) {
    return {
      type: "redirect",
      destination: `/login?next=${encodeURIComponent(pathname)}`,
    };
  }
  if (hasSession && GUEST_ONLY_PATHS.has(pathname)) {
    return { type: "redirect", destination: "/dashboard/calendar" };
  }
  return { type: "allow" };
}
