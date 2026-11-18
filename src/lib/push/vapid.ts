import { createPrivateKey, sign } from "node:crypto";

// VAPID (RFC 8292): a JWT signed with ES256 that says who sends the push
// (spec 040 RNF-1, plan D1). Server only: the private key never leaves it.

export interface VapidKeys {
  /** Uncompressed P-256 point, base64url (NEXT_PUBLIC_VAPID_PUBLIC_KEY). */
  publicKey: string;
  /** The private scalar `d`, base64url (VAPID_PRIVATE_KEY). */
  privateKey: string;
}

/** Valid for 12 hours: push services refuse more than 24 (RFC 8292). */
const LIFETIME_S = 12 * 3600;

const part = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

export function vapidJwt(
  endpoint: string,
  subject: string,
  keys: VapidKeys,
  now: Date = new Date(),
): string {
  const point = Buffer.from(keys.publicKey, "base64url");
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: keys.privateKey,
      x: point.subarray(1, 33).toString("base64url"),
      y: point.subarray(33, 65).toString("base64url"),
    },
    format: "jwk",
  });
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now.getTime() / 1000) + LIFETIME_S,
    sub: subject,
  })}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${unsigned}.${signature.toString("base64url")}`;
}

/** The Authorization header of a push request. */
export function vapidHeader(
  endpoint: string,
  subject: string,
  keys: VapidKeys,
  now: Date = new Date(),
): string {
  return `vapid t=${vapidJwt(endpoint, subject, keys, now)}, k=${keys.publicKey}`;
}
