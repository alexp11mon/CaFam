export type RouteAccess =
  { type: "allow" } | { type: "redirect"; destination: string };

const PROTECTED_PREFIX = "/dashboard";
const GUEST_ONLY_PATHS = new Set(["/login", "/signup"]);

function isProtected(pathname: string): boolean {
  return (
    pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`)
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
  if (hasSession && GUEST_ONLY_PATHS.has(pathname)) {
    return { type: "redirect", destination: "/dashboard" };
  }
  return { type: "allow" };
}
