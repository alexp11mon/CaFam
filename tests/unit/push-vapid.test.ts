// @vitest-environment node
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { vapidHeader, vapidJwt } from "@/lib/push/vapid";

// Spec 040, T1: the VAPID token (RFC 8292) signed with ES256 (RNF-1).
function keys() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const jwk = privateKey.export({ format: "jwk" });
  const raw = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x!, "base64url"),
    Buffer.from(jwk.y!, "base64url"),
  ]);
  return {
    publicKey: raw.toString("base64url"),
    privateKey: jwk.d!,
    keyObject: publicKey,
  };
}

const decode = (part: string) =>
  JSON.parse(Buffer.from(part, "base64url").toString()) as Record<
    string,
    unknown
  >;

describe("vapidJwt", () => {
  const now = new Date("2026-11-18T12:00:00Z");

  it("is an ES256 JWT that the public key verifies", () => {
    const k = keys();
    const jwt = vapidJwt(
      "https://fcm.googleapis.com/fcm/send/abc",
      "mailto:avisos@cafam.test",
      k,
      now,
    );
    const [header, payload, signature] = jwt.split(".");
    expect(decode(header)).toEqual({ typ: "JWT", alg: "ES256" });
    const claims = decode(payload);
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:avisos@cafam.test");
    const exp = Number(claims.exp);
    expect(exp - now.getTime() / 1000).toBeGreaterThan(0);
    expect(exp - now.getTime() / 1000).toBeLessThanOrEqual(24 * 3600);
    const ok = verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      { key: k.keyObject, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    );
    expect(ok).toBe(true);
  });

  it("goes in the Authorization header with the public key", () => {
    const k = keys();
    const header = vapidHeader(
      "https://push.example/x",
      "mailto:a@b.test",
      k,
      now,
    );
    expect(header).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    expect(header.endsWith(`k=${k.publicKey}`)).toBe(true);
    // The public key is a real P-256 point.
    expect(() =>
      createPublicKey({
        key: {
          kty: "EC",
          crv: "P-256",
          x: Buffer.from(k.publicKey, "base64url")
            .subarray(1, 33)
            .toString("base64url"),
          y: Buffer.from(k.publicKey, "base64url")
            .subarray(33)
            .toString("base64url"),
        },
        format: "jwk",
      }),
    ).not.toThrow();
  });
});
