const DEFAULT_PATH = "/dashboard";

// Only an invite link may be a post-login destination (plan D9): accepting any
// `next` would be an open redirect.
const INVITE_PATH = /^\/invite\/[A-Za-z0-9_-]{16,128}$/;

/** Destination after signing in or up: a valid `next`, or the dashboard (RF-7). */
export function getSafeNextPath(next: unknown): string {
  return typeof next === "string" && INVITE_PATH.test(next)
    ? next
    : DEFAULT_PATH;
}
