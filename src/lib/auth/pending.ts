import { getSafeNextPath } from "./next-path";

// Spec 049, RF-1, RF-5: a sign-up waiting for its link. The address stays in
// a short httpOnly cookie for "Reenviar", never in the URL (plan "Resumen").

export const PENDING_COOKIE = "cafam_pending";

export const PENDING_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
} as const;

export interface PendingSignup {
  email: string;
  /** Where to land after confirming: an invite, or the calendar (RF-5). */
  next: string;
}

export function writePending(pending: PendingSignup): string {
  return JSON.stringify(pending);
}

export function readPending(value: string | undefined): PendingSignup | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "email" in parsed &&
      typeof parsed.email === "string" &&
      parsed.email.includes("@")
    ) {
      const next = "next" in parsed ? parsed.next : undefined;
      return { email: parsed.email, next: getSafeNextPath(next) };
    }
  } catch {
    // A cookie written by hand is ignored.
  }
  return null;
}

/** "ana@gmail.com" → "a***@gmail.com" (RF-1). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}
