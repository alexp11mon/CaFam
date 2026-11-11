import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (text: string) => createHash("sha256").update(text).digest();

/**
 * Whether the request carries "Authorization: Bearer <CRON_SECRET>". Hashes
 * are compared in constant time, so neither the content nor the length of the
 * secret leaks through the response time (spec 023 RF-6, plan D5).
 */
export function hasCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  return timingSafeEqual(sha256(given), sha256(`Bearer ${secret}`));
}
