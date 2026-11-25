// The calendar is the home screen (spec 005 RF-15).
const DEFAULT_PATH = "/dashboard/calendar";

// Only an invite link may be a post-login destination (plan D9): accepting any
// `next` would be an open redirect.
const INVITE_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
const INVITE_PATH = /^\/invite\/[A-Za-z0-9_-]{16,128}$/;
// What another app shared waits on the device for the login (spec 047 RF-9, plan D4).
export const SHARE_PATH =
  /^\/dashboard\/share\?id=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape of an invite token; anything else cannot be a real invite (RF-8). */
export function isInviteToken(value: string): boolean {
  return INVITE_TOKEN.test(value);
}

/** Destination after signing in or up: a valid `next`, or the dashboard (RF-7). */
export function getSafeNextPath(next: unknown): string {
  return typeof next === "string" &&
    (INVITE_PATH.test(next) || SHARE_PATH.test(next))
    ? next
    : DEFAULT_PATH;
}
