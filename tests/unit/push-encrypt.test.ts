// @vitest-environment node
import { createECDH, createDecipheriv, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encryptPayload } from "@/lib/push/encrypt";

// Spec 040, T1: the example of RFC 8291, section 5 (RF-17, RNF-1).
const b64 = (text: string) => Buffer.from(text, "base64url");

const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("encryptPayload", () => {
  it("reproduces the RFC 8291 example byte by byte", () => {
    const body = encryptPayload(
      Buffer.from(RFC.plaintext),
      RFC.uaPublic,
      RFC.auth,
      { salt: b64(RFC.salt), serverPrivateKey: b64(RFC.asPrivate) },
    );
    expect(body.toString("base64url")).toBe(RFC.body);
  });

  it("with random keys, the user agent can decrypt it", () => {
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    const auth = Buffer.alloc(16, 7);
    const body = encryptPayload(
      Buffer.from("Hola"),
      ua.getPublicKey().toString("base64url"),
      auth.toString("base64url"),
    );
    const salt = body.subarray(0, 16);
    const asPublic = body.subarray(21, 86);
    const secret = ua.computeSecret(asPublic);
    const hmac = (key: Buffer, data: Buffer) =>
      createHmac("sha256", key).update(data).digest();
    const ikm = hmac(
      hmac(auth, secret),
      Buffer.concat([
        Buffer.from("WebPush: info\0"),
        ua.getPublicKey(),
        asPublic,
        Buffer.from([1]),
      ]),
    );
    const prk = hmac(salt, ikm);
    const cek = hmac(
      prk,
      Buffer.from("Content-Encoding: aes128gcm\0\x01"),
    ).subarray(0, 16);
    const nonce = hmac(
      prk,
      Buffer.from("Content-Encoding: nonce\0\x01"),
    ).subarray(0, 12);
    const data = body.subarray(86);
    const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
    decipher.setAuthTag(data.subarray(data.length - 16));
    const plain = Buffer.concat([
      decipher.update(data.subarray(0, data.length - 16)),
      decipher.final(),
    ]);
    expect(plain.toString()).toBe("Hola\x02");
  });
});
