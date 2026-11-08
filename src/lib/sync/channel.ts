import { randomBytes, randomUUID } from "node:crypto";
import { CHANNEL_RENEW_HOURS } from "./limits";

// Google notification channels (spec 020 plan D8, D10; RF-20, RF-21). Server
// only: the token is a secret per channel and only its SHA-256 is stored.

export interface NewChannel {
  id: string;
  token: string;
}

/** A fresh channel id and a 256-bit token for Google to send back. */
export function newChannel(): NewChannel {
  return { id: randomUUID(), token: randomBytes(32).toString("base64url") };
}

/** Renew when there is no channel or it has less than 24 h left (D8). */
export function shouldRenew(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return true;
  return (
    Date.parse(expiresAt) - now.getTime() < CHANNEL_RENEW_HOURS * 3_600_000
  );
}
